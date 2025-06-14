import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader, 
  DialogTitle,
  DialogTrigger 
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertCircle, BookOpen, Heart, Loader2, Plus, Shield, Target, Users } from "lucide-react";

export default function DMToolkit() {
  const { user, isLoading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState("companions");
  
  if (authLoading) {
    return (
      <div className="container flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary mb-4" />
          <h2 className="text-2xl font-fantasy font-semibold">Loading DM Toolkit</h2>
          <p className="text-muted-foreground">Please wait while we prepare your tools...</p>
        </div>
      </div>
    );
  }
  
  if (!user) {
    return (
      <div className="container flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertCircle className="h-10 w-10 mx-auto text-destructive mb-4" />
          <h2 className="text-2xl font-bold">Authentication Required</h2>
          <p className="text-muted-foreground mb-4">You need to be logged in to access the DM Toolkit.</p>
          <Button asChild>
            <a href="/auth">Login or Register</a>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <div className="space-y-2 mb-8">
        <h1 className="text-3xl font-fantasy font-bold">Dungeon Master Toolkit</h1>
        <p className="text-muted-foreground">Create and manage your campaigns with these powerful tools</p>
      </div>
      
      <Tabs defaultValue="companions" value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 w-full">
          <TabsTrigger value="companions" className="font-medium">
            Companions
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="companions" className="space-y-4">
          <CompanionsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CompanionsTab() {
  const [activeViewTab, setActiveViewTab] = useState("stock-companions"); // "my-companions" or "stock-companions"
  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [selectedRole, setSelectedRole] = useState("companion");
  const [selectedNpcId, setSelectedNpcId] = useState<number | null>(null);
  const { toast } = useToast();
  
  // Fetch user's companions
  const { data: companions = [], isLoading: isLoadingCompanions } = useQuery({
    queryKey: ["/api/npcs/companions"],
    refetchOnWindowFocus: false,
  });
  
  // Fetch stock companions
  const { data: stockCompanions = [], isLoading: isLoadingStockCompanions } = useQuery({
    queryKey: ["/api/npcs/stock-companions"],
    refetchOnWindowFocus: false,
  });
  
  // Fetch campaigns for dropdown
  const { data: campaigns = [], isLoading: isLoadingCampaigns } = useQuery({
    queryKey: ["/api/campaigns"],
    refetchOnWindowFocus: false,
  });
  
  // Mutation to add NPC to campaign
  const addToCampaignMutation = useMutation({
    mutationFn: async (data: { campaignId: number; npcId: number; role: string }) => {
      const response = await apiRequest("POST", "/api/campaigns/npcs", data);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to add companion to campaign");
      }
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success!",
        description: "Companion has been added to your campaign.",
      });
      // Reset selection state
      setSelectedCampaignId("");
      setSelectedNpcId(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add companion to campaign",
        variant: "destructive",
      });
    },
  });

  if (isLoadingCompanions || isLoadingStockCompanions) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading companions...</span>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-fantasy font-semibold">NPC Companions</h2>
          <p className="text-muted-foreground">Add companion NPCs to your campaigns</p>
        </div>
        <Button>
          <Plus size={16} className="mr-2" />
          Create Companion
        </Button>
      </div>
      
      {/* Tab navigation */}
      <div className="border-b mb-6">
        <div className="flex">
          <button
            className={`px-4 py-2 font-medium text-sm ${
              activeViewTab === "my-companions"
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setActiveViewTab("my-companions")}
          >
            My Companions
          </button>
          <button
            className={`px-4 py-2 font-medium text-sm ${
              activeViewTab === "stock-companions"
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setActiveViewTab("stock-companions")}
          >
            Ready-Made Companions
          </button>
        </div>
      </div>
      
      {/* Display companions based on active tab */}
      {activeViewTab === "stock-companions" ? (
        <div>
          <p className="mb-4 text-sm text-muted-foreground">
            These ready-made companions can be added directly to your campaigns without needing to create them from scratch.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.isArray(stockCompanions) && stockCompanions.map((companion: any) => (
              <Card key={companion.id} className="border-2 border-primary/10 hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <CardTitle className="font-fantasy">{companion.name}</CardTitle>
                    {companion.companionType && (
                      <Badge className={
                        companion.companionType === "combat" ? "bg-red-600" :
                        companion.companionType === "support" ? "bg-green-600" :
                        companion.companionType === "utility" ? "bg-blue-600" :
                        "bg-purple-600"
                      }>
                        {companion.companionType === "combat" ? "Combat" :
                         companion.companionType === "support" ? "Support" :
                         companion.companionType === "utility" ? "Utility" : "Social"}
                      </Badge>
                    )}
                  </div>
                  <CardDescription>{companion.race} • {companion.occupation}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="text-sm">
                      {companion.personality && companion.personality.length > 100 
                        ? companion.personality.substring(0, 100) + "..." 
                        : companion.personality}
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Target className="h-3 w-3" />
                        <span>Level {companion.level || 1}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Heart className="h-3 w-3 text-red-500" />
                        <span>HP {companion.hitPoints || 10}/{companion.maxHitPoints || 10}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Shield className="h-3 w-3" />
                        <span>AC {companion.armorClass || 10}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-4 pt-2 border-t flex justify-end">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => setSelectedNpcId(companion.id)}
                        >
                          Add to Campaign
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Add {companion.name} to Campaign</DialogTitle>
                          <DialogDescription>
                            Select which campaign you want to add this companion to
                          </DialogDescription>
                        </DialogHeader>
                        
                        <div className="py-4 space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="campaign">Campaign</Label>
                            <Select value={selectedCampaignId} onValueChange={setSelectedCampaignId}>
                              <SelectTrigger id="campaign">
                                <SelectValue placeholder="Select a campaign" />
                              </SelectTrigger>
                              <SelectContent>
                                {Array.isArray(campaigns) && campaigns.map((campaign: any) => (
                                  <SelectItem key={campaign.id} value={campaign.id.toString()}>
                                    {campaign.title}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          
                          <div className="space-y-2">
                            <Label htmlFor="role">Role in Campaign</Label>
                            <Select value={selectedRole} onValueChange={setSelectedRole}>
                              <SelectTrigger id="role">
                                <SelectValue placeholder="Select a role" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="companion">Companion</SelectItem>
                                <SelectItem value="ally">Ally</SelectItem>
                                <SelectItem value="neutral">Neutral</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        
                        <DialogFooter>
                          <Button
                            onClick={() => {
                              if (selectedCampaignId && selectedNpcId) {
                                addToCampaignMutation.mutate({
                                  campaignId: parseInt(selectedCampaignId),
                                  npcId: selectedNpcId,
                                  role: selectedRole
                                });
                              } else {
                                toast({
                                  title: "Missing information",
                                  description: "Please select a campaign",
                                  variant: "destructive"
                                });
                              }
                            }}
                            disabled={addToCampaignMutation.isPending}
                          >
                            {addToCampaignMutation.isPending ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Adding...
                              </>
                            ) : (
                              "Add to Campaign"
                            )}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : (
        // My Companions Tab
        <div>
          {Array.isArray(companions) && companions.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {companions.map((companion: any) => (
                <Card key={companion.id} className="border hover:shadow-md transition-shadow">
                  <CardHeader>
                    <CardTitle>{companion.name}</CardTitle>
                    <CardDescription>{companion.race} • {companion.occupation}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p>{companion.personality}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Users className="h-12 w-12 mx-auto mb-2 text-muted-foreground" />
              <p className="text-muted-foreground">You haven't created any companions yet</p>
              <Button className="mt-4">Create Companion</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}