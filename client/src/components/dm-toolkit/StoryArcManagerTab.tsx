import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, Plus, Users, Send, Eye, CheckCircle } from "lucide-react";

interface StoryArc {
  id: number;
  title: string;
  description: string;
  theme: string;
  setting: string;
  overallGoal: string;
  estimatedSessions: number;
  difficulty: string;
  totalActs: number;
  currentAct: number;
  isActive: boolean;
  createdAt: string;
}

interface PlotPoint {
  id: number;
  storyArcId: number;
  act: number;
  sequence: number;
  title: string;
  description: string;
  plotType: string;
  triggerConditions: string[];
  playerChoicesImpact: any;
  npcsInvolved: any[];
  locationsInvolved: any[];
  rewards: any[];
  isCompleted: boolean;
  createdAt: string;
}

interface StoryArcManagerTabProps {
  campaignId: number;
}

export default function StoryArcManagerTab({ campaignId }: StoryArcManagerTabProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedArcId, setSelectedArcId] = useState<number | null>(null);
  
  // Story Arc Generation Form
  const [arcForm, setArcForm] = useState({
    theme: "",
    setting: "",
    difficulty: "medium",
    estimatedSessions: 5,
    playerLevel: ""
  });

  // Invitation Form
  const [invitationForm, setInvitationForm] = useState({
    emails: [""],
    personalMessage: "",
    role: "player"
  });

  // Fetch campaign story arcs
  const { data: storyArcs = [], isLoading: arcsLoading } = useQuery({
    queryKey: ['/api/story-arcs', campaignId],
    enabled: !!campaignId
  });

  // Fetch plot points for selected arc
  const { data: plotPoints = [], isLoading: plotPointsLoading } = useQuery({
    queryKey: ['/api/plot-points', selectedArcId],
    enabled: !!selectedArcId
  });

  // Fetch campaign invitations
  const { data: invitations = [], isLoading: invitationsLoading } = useQuery({
    queryKey: ['/api/campaigns', campaignId, 'invitations'],
    enabled: !!campaignId
  });

  // Generate story arc mutation
  const generateStoryArcMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest(`/api/story-arcs/generate`, {
        method: 'POST',
        body: JSON.stringify({ ...data, campaignId })
      });
    },
    onSuccess: (data) => {
      toast({
        title: "Story Arc Generated",
        description: `Created "${data.storyArc.title}" with ${data.plotPoints.length} plot points`
      });
      queryClient.invalidateQueries({ queryKey: ['/api/story-arcs'] });
      setArcForm({
        theme: "",
        setting: "",
        difficulty: "medium",
        estimatedSessions: 5,
        playerLevel: ""
      });
    },
    onError: (error: any) => {
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate story arc",
        variant: "destructive"
      });
    }
  });

  // Send invitations mutation
  const sendInvitationsMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest(`/api/campaigns/${campaignId}/invitations`, {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },
    onSuccess: (data) => {
      toast({
        title: "Invitations Sent",
        description: `Sent ${data.invitations.length} campaign invitations`
      });
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns', campaignId, 'invitations'] });
      setInvitationForm({
        emails: [""],
        personalMessage: "",
        role: "player"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Invitation Failed",
        description: error.message || "Failed to send invitations",
        variant: "destructive"
      });
    }
  });

  const handleGenerateStoryArc = () => {
    if (!arcForm.theme || !arcForm.setting) {
      toast({
        title: "Missing Information",
        description: "Please provide both theme and setting",
        variant: "destructive"
      });
      return;
    }
    generateStoryArcMutation.mutate(arcForm);
  };

  const handleSendInvitations = () => {
    const validEmails = invitationForm.emails.filter(email => 
      email.trim() && email.includes('@')
    );
    
    if (validEmails.length === 0) {
      toast({
        title: "No Valid Emails",
        description: "Please provide at least one valid email address",
        variant: "destructive"
      });
      return;
    }

    sendInvitationsMutation.mutate({
      emails: validEmails,
      personalMessage: invitationForm.personalMessage,
      role: invitationForm.role
    });
  };

  const addEmailField = () => {
    setInvitationForm(prev => ({
      ...prev,
      emails: [...prev.emails, ""]
    }));
  };

  const updateEmail = (index: number, value: string) => {
    setInvitationForm(prev => ({
      ...prev,
      emails: prev.emails.map((email, i) => i === index ? value : email)
    }));
  };

  const removeEmail = (index: number) => {
    setInvitationForm(prev => ({
      ...prev,
      emails: prev.emails.filter((_, i) => i !== index)
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Campaign Story Arc Manager</h3>
          <p className="text-sm text-muted-foreground">
            Generate AI-powered story arcs and manage player invitations
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="generate">Generate Arc</TabsTrigger>
          <TabsTrigger value="invitations">Invitations</TabsTrigger>
          <TabsTrigger value="plot-points">Plot Points</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4">
            {arcsLoading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : storyArcs.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center">
                  <h4 className="text-lg font-medium mb-2">No Story Arcs Yet</h4>
                  <p className="text-muted-foreground mb-4">
                    Create your first AI-generated story arc to begin your campaign
                  </p>
                  <Button onClick={() => setActiveTab("generate")}>
                    <Plus className="h-4 w-4 mr-2" />
                    Generate Story Arc
                  </Button>
                </CardContent>
              </Card>
            ) : (
              storyArcs.map((arc: StoryArc) => (
                <Card key={arc.id} className="cursor-pointer hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{arc.title}</CardTitle>
                      <div className="flex gap-2">
                        <Badge variant={arc.isActive ? "default" : "secondary"}>
                          {arc.isActive ? "Active" : "Inactive"}
                        </Badge>
                        <Badge variant="outline">
                          Act {arc.currentAct || 1}/{arc.totalActs}
                        </Badge>
                        <Badge variant="outline" className="capitalize">
                          {arc.difficulty}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-3">
                      {arc.description}
                    </p>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium">Theme:</span> {arc.theme}
                      </div>
                      <div>
                        <span className="font-medium">Setting:</span> {arc.setting}
                      </div>
                      <div>
                        <span className="font-medium">Sessions:</span> {arc.estimatedSessions}
                      </div>
                      <div>
                        <span className="font-medium">Goal:</span> {arc.overallGoal}
                      </div>
                    </div>
                    <div className="flex gap-2 mt-4">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => {
                          setSelectedArcId(arc.id);
                          setActiveTab("plot-points");
                        }}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View Plot Points
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="generate" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Generate New Story Arc</CardTitle>
              <p className="text-sm text-muted-foreground">
                Create an AI-powered story arc with dynamic plot points
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="theme">Theme</Label>
                  <Input
                    id="theme"
                    placeholder="e.g., Political Intrigue, Ancient Evil, War"
                    value={arcForm.theme}
                    onChange={(e) => setArcForm(prev => ({ ...prev, theme: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="setting">Setting</Label>
                  <Input
                    id="setting"
                    placeholder="e.g., Medieval Kingdom, Steampunk City, Space Station"
                    value={arcForm.setting}
                    onChange={(e) => setArcForm(prev => ({ ...prev, setting: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="difficulty">Difficulty</Label>
                  <Select 
                    value={arcForm.difficulty} 
                    onValueChange={(value) => setArcForm(prev => ({ ...prev, difficulty: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="easy">Easy</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="hard">Hard</SelectItem>
                      <SelectItem value="epic">Epic</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sessions">Estimated Sessions</Label>
                  <Input
                    id="sessions"
                    type="number"
                    min="1"
                    max="20"
                    value={arcForm.estimatedSessions}
                    onChange={(e) => setArcForm(prev => ({ ...prev, estimatedSessions: parseInt(e.target.value) }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="playerLevel">Player Level</Label>
                  <Input
                    id="playerLevel"
                    placeholder="e.g., 1-3, 5, mixed"
                    value={arcForm.playerLevel}
                    onChange={(e) => setArcForm(prev => ({ ...prev, playerLevel: e.target.value }))}
                  />
                </div>
              </div>

              <Button 
                onClick={handleGenerateStoryArc}
                disabled={generateStoryArcMutation.isPending}
                className="w-full"
              >
                {generateStoryArcMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                Generate Story Arc
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invitations" className="space-y-4">
          <div className="grid gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Send Campaign Invitations</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Invite players to join your campaign
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Player Emails</Label>
                  {invitationForm.emails.map((email, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        placeholder="player@example.com"
                        value={email}
                        onChange={(e) => updateEmail(index, e.target.value)}
                      />
                      {invitationForm.emails.length > 1 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => removeEmail(index)}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={addEmailField}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Email
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select 
                    value={invitationForm.role} 
                    onValueChange={(value) => setInvitationForm(prev => ({ ...prev, role: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="player">Player</SelectItem>
                      <SelectItem value="co-dm">Co-DM</SelectItem>
                      <SelectItem value="observer">Observer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message">Personal Message (Optional)</Label>
                  <Textarea
                    id="message"
                    placeholder="Join my D&D campaign for an epic adventure..."
                    value={invitationForm.personalMessage}
                    onChange={(e) => setInvitationForm(prev => ({ ...prev, personalMessage: e.target.value }))}
                    rows={3}
                  />
                </div>

                <Button 
                  onClick={handleSendInvitations}
                  disabled={sendInvitationsMutation.isPending}
                  className="w-full"
                >
                  {sendInvitationsMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Send Invitations
                </Button>
              </CardContent>
            </Card>

            {/* Existing Invitations */}
            <Card>
              <CardHeader>
                <CardTitle>Sent Invitations</CardTitle>
              </CardHeader>
              <CardContent>
                {invitationsLoading ? (
                  <div className="flex items-center justify-center p-4">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : invitations.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">
                    No invitations sent yet
                  </p>
                ) : (
                  <div className="space-y-2">
                    {invitations.map((invitation: any) => (
                      <div key={invitation.id} className="flex items-center justify-between p-3 border rounded">
                        <div>
                          <div className="font-medium">{invitation.inviteeEmail}</div>
                          <div className="text-sm text-muted-foreground">
                            {invitation.role} • Sent {new Date(invitation.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                        <Badge variant={invitation.status === 'accepted' ? 'default' : 'secondary'}>
                          {invitation.status || 'pending'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="plot-points" className="space-y-4">
          {selectedArcId ? (
            <Card>
              <CardHeader>
                <CardTitle>Plot Points</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Dynamic story progression for your campaign
                </p>
              </CardHeader>
              <CardContent>
                {plotPointsLoading ? (
                  <div className="flex items-center justify-center p-4">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : plotPoints.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">
                    No plot points found
                  </p>
                ) : (
                  <div className="space-y-4">
                    {plotPoints.map((point: PlotPoint) => (
                      <Card key={point.id} className="border-l-4 border-l-blue-500">
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-base">{point.title}</CardTitle>
                            <div className="flex gap-2">
                              <Badge variant="outline">Act {point.act}</Badge>
                              <Badge variant="outline" className="capitalize">{point.plotType}</Badge>
                              {point.isCompleted && (
                                <Badge variant="default">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Completed
                                </Badge>
                              )}
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-muted-foreground mb-3">
                            {point.description}
                          </p>
                          {point.triggerConditions.length > 0 && (
                            <div className="mb-2">
                              <span className="text-xs font-medium">Trigger Conditions:</span>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {point.triggerConditions.map((condition, index) => (
                                  <Badge key={index} variant="secondary" className="text-xs">
                                    {condition}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-6 text-center">
                <h4 className="text-lg font-medium mb-2">Select a Story Arc</h4>
                <p className="text-muted-foreground">
                  Choose a story arc from the Overview tab to view its plot points
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}