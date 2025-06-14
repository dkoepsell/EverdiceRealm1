import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from "@/components/ui/accordion";
import { 
  AlertCircle, 
  BookOpen, 
  Heart, 
  Loader2, 
  Plus, 
  Shield, 
  Target, 
  Users,
  MapPin,
  Castle,
  Trees,
  Building,
  Landmark,
  Mountain,
  Droplets,
  Compass,
  Info,
  Scroll,
  Sparkles,
  Swords,
  Star,
  Circle,
  Send,
  Globe,
  Mail,
  StickyNote,
  Play as PlayIcon,
  Clock,
  Play,
  Check,
  Zap,
  Star as StarIcon,
  Brain,
  Lightbulb,
  ChevronLeft,
  ChevronRight
} from "lucide-react";

// Import our tabs
import InvitationsTab from "@/components/dm-toolkit/InvitationsTab";
import NotesTabSimple from "@/components/dm-toolkit/NotesTabSimple";
import AIAssistedDMGuide from "@/components/dm-toolkit/AIAssistedDMGuide";
import LiveCampaignManagerTab from "@/components/dm-toolkit/LiveCampaignManagerTab";
import DMTrainingCenterTab from "@/components/dm-toolkit/DMTrainingCenterTab";

export default function DMToolkit() {
  const { user, isLoading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState("training");
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | null>(null);
  const [showAIGuide, setShowAIGuide] = useState(false);
  
  // Fetch campaigns
  const { data: campaigns = [] } = useQuery<any[]>({
    queryKey: ["/api/campaigns"],
    enabled: !!user
  });
  
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
    <div className="container px-4 py-6 md:py-8">
      <div className="space-y-2 mb-6 md:mb-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl md:text-3xl font-fantasy font-bold">Dungeon Master Toolkit</h1>
            <p className="text-sm md:text-base text-muted-foreground">Create and manage your campaigns with these powerful tools</p>
          </div>
          <div className="flex space-x-2">
            {campaigns.length > 0 && (
              <Select value={selectedCampaignId?.toString() || ""} onValueChange={(value) => setSelectedCampaignId(parseInt(value))}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Select Campaign" />
                </SelectTrigger>
                <SelectContent>
                  {campaigns.map((campaign) => (
                    <SelectItem key={campaign.id} value={campaign.id.toString()}>
                      {campaign.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button
              variant="default"
              onClick={() => setShowAIGuide(true)}
              className="text-sm bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
              disabled={!selectedCampaignId}
            >
              <Sparkles className="h-4 w-4 mr-2" />
              AI DM Assistant
            </Button>
          </div>
        </div>
      </div>
      
      <Tabs defaultValue="training" value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid grid-cols-5 md:grid-cols-8 lg:grid-cols-10 w-full overflow-x-auto">
          <TabsTrigger value="training" className="text-xs md:text-sm font-medium px-2 py-1.5 md:px-3 md:py-2">
            <BookOpen className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1 hidden sm:inline-block" />
            DM Training
          </TabsTrigger>
          <TabsTrigger value="live-manager" className="text-xs md:text-sm font-medium px-2 py-1.5 md:px-3 md:py-2">
            <PlayIcon className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1 hidden sm:inline-block" />
            Live Manager
          </TabsTrigger>
          <TabsTrigger value="companions" className="text-xs md:text-sm font-medium px-2 py-1.5 md:px-3 md:py-2">
            Companions
          </TabsTrigger>
          <TabsTrigger value="locations" className="text-xs md:text-sm font-medium px-2 py-1.5 md:px-3 md:py-2">
            Locations
          </TabsTrigger>
          <TabsTrigger value="quests" className="text-xs md:text-sm font-medium px-2 py-1.5 md:px-3 md:py-2">
            Quests
          </TabsTrigger>
          <TabsTrigger value="items" className="text-xs md:text-sm font-medium px-2 py-1.5 md:px-3 md:py-2">
            Items
          </TabsTrigger>
          <TabsTrigger value="monsters" className="text-xs md:text-sm font-medium px-2 py-1.5 md:px-3 md:py-2">
            Monsters
          </TabsTrigger>
          <TabsTrigger value="invitations" className="text-xs md:text-sm font-medium px-2 py-1.5 md:px-3 md:py-2">
            <Mail className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1 hidden sm:inline-block" />
            Invitations
          </TabsTrigger>
          <TabsTrigger value="notes" className="text-xs md:text-sm font-medium px-2 py-1.5 md:px-3 md:py-2">
            <StickyNote className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1 hidden sm:inline-block" />
            Notes
          </TabsTrigger>
          <TabsTrigger value="generators" className="text-xs md:text-sm font-medium px-2 py-1.5 md:px-3 md:py-2">
            Generators
          </TabsTrigger>
          <TabsTrigger value="deploy" className="text-xs md:text-sm font-medium px-2 py-1.5 md:px-3 md:py-2">
            Deploy
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="training" className="space-y-4">
          <DMTrainingCenterTab />
        </TabsContent>
        
        <TabsContent value="live-manager" className="space-y-4">
          <LiveCampaignManagerTab 
            selectedCampaignId={selectedCampaignId}
            onCampaignSelect={setSelectedCampaignId}
          />
        </TabsContent>
        
        <TabsContent value="companions" className="space-y-4">
          <CompanionsTab />
        </TabsContent>
        
        <TabsContent value="locations" className="space-y-4">
          <LocationsTab />
        </TabsContent>
        
        <TabsContent value="quests" className="space-y-4">
          <QuestsTab />
        </TabsContent>
        
        <TabsContent value="items" className="space-y-4">
          <MagicItemsTab />
        </TabsContent>
        
        <TabsContent value="monsters" className="space-y-4">
          <MonstersTab />
        </TabsContent>

        <TabsContent value="invitations" className="space-y-4">
          <InvitationsTab />
        </TabsContent>
        
        <TabsContent value="notes" className="space-y-4">
          <NotesTabSimple />
        </TabsContent>
        
        <TabsContent value="generators" className="space-y-4">
          <DMWorkflowAndGuidance />
        </TabsContent>
        
        <TabsContent value="deploy" className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-fantasy font-semibold flex items-center">
                <Send className="h-5 w-5 mr-2 text-primary" />
                Deploy Created Assets to Campaign
              </h2>
              <p className="text-muted-foreground">Turn your creations into a deployable campaign for players</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Globe className="h-5 w-5 mr-2 text-primary" />
                  Create Campaign from Assets
                </CardTitle>
                <CardDescription>
                  Generate a new campaign using the companions, locations, and quests you've created
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="campaign-name">Campaign Name</Label>
                  <Input id="campaign-name" placeholder="Enter a name for your campaign" />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="campaign-description">Description</Label>
                  <Textarea id="campaign-description" placeholder="Describe your campaign to potential players" />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="difficulty">Difficulty</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Select difficulty" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="beginner">Beginner</SelectItem>
                        <SelectItem value="intermediate">Intermediate</SelectItem>
                        <SelectItem value="advanced">Advanced</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="style">Style</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Select style" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="heroic">Heroic</SelectItem>
                        <SelectItem value="gritty">Gritty</SelectItem>
                        <SelectItem value="mystery">Mystery</SelectItem>
                        <SelectItem value="horror">Horror</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button className="w-full">
                  Create Deployable Campaign
                </Button>
              </CardFooter>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Your Created Assets</CardTitle>
                <CardDescription>Select assets to include in your campaign</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label>Companions</Label>
                    <Badge variant="outline">3 Selected</Badge>
                  </div>
                  <div className="border rounded-md p-2 space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox id="companion-1" />
                      <Label htmlFor="companion-1" className="text-sm">Grimshaw the Guardian</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="companion-2" />
                      <Label htmlFor="companion-2" className="text-sm">Seraphina the Sage</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="companion-3" checked />
                      <Label htmlFor="companion-3" className="text-sm">Thorne Ironfist</Label>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label>Locations</Label>
                    <Badge variant="outline">2 Selected</Badge>
                  </div>
                  <div className="border rounded-md p-2 space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox id="location-1" checked />
                      <Label htmlFor="location-1" className="text-sm">Whispering Forest</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="location-2" checked />
                      <Label htmlFor="location-2" className="text-sm">Frostfall Mountains</Label>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label>Quests</Label>
                    <Badge variant="outline">1 Selected</Badge>
                  </div>
                  <div className="border rounded-md p-2 space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox id="quest-1" checked />
                      <Label htmlFor="quest-1" className="text-sm">The Lost Artifact</Label>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          
          <Card className="mt-4 border-primary/20 bg-secondary/10">
            <CardHeader>
              <CardTitle className="flex items-center text-primary">
                <Info className="mr-2 h-5 w-5" />
                About Campaign Deployment
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Deployment allows you to create a fully playable campaign from your assets that can be:
              </p>
              <ul className="text-sm text-muted-foreground space-y-2 list-disc pl-5">
                <li>Shared with other players using a join code</li>
                <li>Run by you as the DM for a live group</li>
                <li>Set as an automated campaign that players can join and play asynchronously</li>
                <li>Made public in the campaign directory for anyone to discover</li>
                <li>Customized with your own rules, difficulty levels, and narrative styles</li>
              </ul>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* AI-Assisted DM Guide */}
      {showAIGuide && selectedCampaignId && (
        <AIAssistedDMGuide 
          campaignId={selectedCampaignId}
          onClose={() => setShowAIGuide(false)}
        />
      )}
    </div>
  );
}

import { CompanionDetailsDialog } from "@/components/companions/CompanionDetailsDialog";

function CompanionsTab() {
  const [activeViewTab, setActiveViewTab] = useState("stock-companions"); // "my-companions" or "stock-companions"
  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [selectedRole, setSelectedRole] = useState("companion");
  const [selectedNpcId, setSelectedNpcId] = useState<number | null>(null);
  const [selectedCompanion, setSelectedCompanion] = useState<any>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const { toast } = useToast();
  const isMobile = window.innerWidth < 768;
  
  // Fetch user's companions
  const { data: companions = [], isLoading: isLoadingCompanions } = useQuery<any[]>({
    queryKey: ["/api/npcs/companions"],
    refetchOnWindowFocus: false,
  });
  
  // Fetch stock companions
  const { data: stockCompanions = [], isLoading: isLoadingStockCompanions } = useQuery<any[]>({
    queryKey: ["/api/npcs/stock-companions"],
    refetchOnWindowFocus: false,
  });

  // Fetch user's campaigns
  const { data: campaigns = [], isLoading: isLoadingCampaigns } = useQuery<any[]>({
    queryKey: ["/api/campaigns"],
    refetchOnWindowFocus: false,
  });
  
  // Add to campaign mutation
  const addToCampaignMutation = useMutation({
    mutationFn: async (data: { campaignId: string; npcId: number; role: string }) => {
      return await apiRequest("POST", `/api/campaigns/${data.campaignId}/npcs`, {
        npcId: data.npcId,
        role: data.role,
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Companion added to campaign successfully",
      });
      
      // Reset selections
      setSelectedCampaignId("");
      setSelectedNpcId(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  const handleAddToCampaign = () => {
    if (!selectedCampaignId || !selectedNpcId) {
      toast({
        title: "Error",
        description: "Please select both a campaign and a companion",
        variant: "destructive",
      });
      return;
    }
    
    addToCampaignMutation.mutate({
      campaignId: selectedCampaignId,
      npcId: selectedNpcId,
      role: selectedRole,
    });
  };
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-fantasy font-semibold">Companions & NPCs</h2>
          <p className="text-muted-foreground">Create and manage companions for your adventures</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setActiveViewTab("my-companions")}>
            My Companions
          </Button>
          <Button variant="outline" onClick={() => setActiveViewTab("stock-companions")}>
            Ready-Made Companions
          </Button>
        </div>
      </div>
      
      {activeViewTab === "my-companions" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
            {isLoadingCompanions ? (
              <div className="col-span-full flex items-center justify-center py-8 md:py-12">
                <Loader2 className="h-6 w-6 md:h-8 md:w-8 animate-spin text-muted-foreground" />
              </div>
            ) : companions.length === 0 ? (
              <div className="col-span-full text-center py-8 md:py-12">
                <Users className="h-10 w-10 md:h-12 md:w-12 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm md:text-base text-muted-foreground">You haven't created any companions yet</p>
                <Button className="mt-4 text-xs md:text-sm" size={isMobile ? "sm" : "default"}>
                  <Plus className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" /> Create Companion
                </Button>
              </div>
            ) : (
              companions.map((companion: any) => (
                <Card key={companion.id} className="overflow-hidden">
                  <CardHeader className="pb-2 px-3 py-3 md:px-6 md:py-4">
                    <div className="flex justify-between items-start">
                      <CardTitle className="font-fantasy text-base md:text-lg">{companion.name}</CardTitle>
                      <Badge className="text-xs ml-1">{companion.race}</Badge>
                    </div>
                    <CardDescription className="text-xs md:text-sm">{companion.class}</CardDescription>
                  </CardHeader>
                  <CardContent className="pb-0 px-3 md:px-6">
                    <p className="text-xs md:text-sm mb-2 md:mb-3 line-clamp-3">
                      {companion.backstory?.substring(0, isMobile ? 80 : 120)}...
                    </p>
                    <div className="flex justify-between text-xs md:text-sm text-muted-foreground">
                      <span>Level {companion.level}</span>
                      <span>{companion.alignment}</span>
                    </div>
                  </CardContent>
                  <CardFooter className="pt-2 px-3 py-3 md:px-6 md:py-4">
                    <div className="flex flex-col xs:flex-row w-full gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="text-xs w-full xs:w-auto"
                        onClick={() => {
                          setSelectedCompanion(companion);
                          setShowDetailsDialog(true);
                        }}
                      >
                        View Details
                      </Button>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button 
                            size="sm"
                            className="text-xs w-full xs:w-auto"
                            onClick={() => setSelectedNpcId(companion.id)}
                          >
                            Add to Campaign
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-[90vw] w-[400px]">
                          <DialogHeader>
                            <DialogTitle>Add to Campaign</DialogTitle>
                            <DialogDescription className="text-xs md:text-sm">
                              Select a campaign to add {companion.name} to as a companion
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="space-y-2">
                              <Label htmlFor="campaign" className="text-xs md:text-sm">Campaign</Label>
                              <Select
                                value={selectedCampaignId}
                                onValueChange={setSelectedCampaignId}
                              >
                                <SelectTrigger className="text-xs md:text-sm">
                                  <SelectValue placeholder="Select campaign" />
                                </SelectTrigger>
                                <SelectContent>
                                  {campaigns.map((campaign: any) => (
                                    <SelectItem key={campaign.id} value={campaign.id.toString()} className="text-xs md:text-sm">
                                      {campaign.name || campaign.title}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            
                            <div className="space-y-2">
                              <Label htmlFor="role" className="text-xs md:text-sm">Role</Label>
                              <Select
                                value={selectedRole}
                                onValueChange={setSelectedRole}
                              >
                                <SelectTrigger className="text-xs md:text-sm">
                                  <SelectValue placeholder="Select role" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="companion" className="text-xs md:text-sm">Companion</SelectItem>
                                  <SelectItem value="ally" className="text-xs md:text-sm">Ally</SelectItem>
                                  <SelectItem value="quest-giver" className="text-xs md:text-sm">Quest Giver</SelectItem>
                                  <SelectItem value="merchant" className="text-xs md:text-sm">Merchant</SelectItem>
                                  <SelectItem value="antagonist" className="text-xs md:text-sm">Antagonist</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <DialogFooter>
                            <Button
                              onClick={handleAddToCampaign}
                              disabled={addToCampaignMutation.isPending}
                              className="text-xs md:text-sm"
                              size={isMobile ? "sm" : "default"}
                            >
                              {addToCampaignMutation.isPending && (
                                <Loader2 className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2 animate-spin" />
                              )}
                              Add to Campaign
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </CardFooter>
                </Card>
              ))
            )}
          </div>
          
          <div className="text-center">
            <Button>
              <Plus className="h-4 w-4 mr-2" /> Create New Companion
            </Button>
          </div>
        </div>
      )}
      
      {activeViewTab === "stock-companions" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {isLoadingStockCompanions ? (
              <div className="col-span-full flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : stockCompanions.length === 0 ? (
              <div className="col-span-full text-center py-12">
                <Users className="h-12 w-12 mx-auto mb-2 text-muted-foreground" />
                <p className="text-muted-foreground">No stock companions available</p>
              </div>
            ) : (
              stockCompanions.map((companion: any) => (
                <Card key={companion.id} className="overflow-hidden">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between">
                      <CardTitle className="font-fantasy">{companion.name}</CardTitle>
                      <Badge>{companion.race}</Badge>
                    </div>
                    <CardDescription>{companion.class}</CardDescription>
                  </CardHeader>
                  <CardContent className="pb-0">
                    <p className="text-sm mb-3">{companion.backstory?.substring(0, 120)}...</p>
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>Level {companion.level}</span>
                      <span>{companion.alignment}</span>
                    </div>
                  </CardContent>
                  <CardFooter className="pt-2">
                    <div className="flex justify-between w-full">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          setSelectedCompanion(companion);
                          setShowDetailsDialog(true);
                        }}
                      >
                        View Details
                      </Button>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button 
                            size="sm"
                            onClick={() => setSelectedNpcId(companion.id)}
                          >
                            Add to Campaign
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Add to Campaign</DialogTitle>
                            <DialogDescription>
                              Select a campaign to add {companion.name} to as a companion
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="space-y-2">
                              <Label htmlFor="campaign">Campaign</Label>
                              <Select
                                value={selectedCampaignId}
                                onValueChange={setSelectedCampaignId}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select campaign" />
                                </SelectTrigger>
                                <SelectContent>
                                  {campaigns.map((campaign: any) => (
                                    <SelectItem key={campaign.id} value={campaign.id.toString()}>
                                      {campaign.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            
                            <div className="space-y-2">
                              <Label htmlFor="role">Role</Label>
                              <Select
                                value={selectedRole}
                                onValueChange={setSelectedRole}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select role" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="companion">Companion</SelectItem>
                                  <SelectItem value="ally">Ally</SelectItem>
                                  <SelectItem value="quest-giver">Quest Giver</SelectItem>
                                  <SelectItem value="merchant">Merchant</SelectItem>
                                  <SelectItem value="antagonist">Antagonist</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <DialogFooter>
                            <Button
                              onClick={handleAddToCampaign}
                              disabled={addToCampaignMutation.isPending}
                            >
                              {addToCampaignMutation.isPending && (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              )}
                              Add to Campaign
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </CardFooter>
                </Card>
              ))
            )}
          </div>
        </div>
      )}
      
      {/* Details Dialog */}
      {selectedCompanion && (
        <CompanionDetailsDialog
          companion={selectedCompanion}
          isOpen={showDetailsDialog}
          onOpenChange={setShowDetailsDialog}
        />
      )}
    </div>
  );
}

function LocationsTab() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newLocation, setNewLocation] = useState({
    name: "",
    type: "",
    description: "",
    population: "",
    government: "",
    notable_features: "",
    notes: ""
  });
  const { toast } = useToast();

  // Fetch locations from the API
  const { data: locations = [], isLoading: locationsLoading } = useQuery<any[]>({
    queryKey: ["/api/locations"],
  });

  const createLocationMutation = useMutation({
    mutationFn: async (locationData: any) => {
      return await apiRequest("POST", "/api/locations", locationData);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Location created successfully",
      });
      setShowCreateDialog(false);
      setNewLocation({ 
        name: "", 
        type: "", 
        description: "", 
        population: "", 
        government: "", 
        notable_features: "", 
        notes: "" 
      });
      queryClient.invalidateQueries({ queryKey: ["/api/locations"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCreateLocation = () => {
    if (!newLocation.name.trim()) {
      toast({
        title: "Error",
        description: "Location name is required",
        variant: "destructive",
      });
      return;
    }
    createLocationMutation.mutate(newLocation);
  };

  const aiGenerateLocationMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/ai-generate/location", {});
      return await response.json();
    },
    onSuccess: (data) => {
      setNewLocation({
        name: data.name || "",
        type: data.type || "",
        description: data.description || "",
        population: data.population || "",
        government: data.government || "",
        notable_features: data.notable_features || "",
        notes: data.notes || ""
      });
      setShowCreateDialog(true);
      toast({
        title: "Success",
        description: "AI generated location ready for review",
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

  const handleAIGenerate = (type: string) => {
    if (type === 'location') {
      aiGenerateLocationMutation.mutate();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-fantasy font-semibold">Locations & Maps</h2>
          <p className="text-muted-foreground">Create and manage locations for your adventures</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" /> Create Location
          </Button>
          <Button variant="outline" onClick={() => handleAIGenerate('location')}>
            <Sparkles className="h-4 w-4 mr-2" /> AI Generate
          </Button>
        </div>
      </div>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New Location</DialogTitle>
            <DialogDescription>
              Add a new location to your campaign world
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">Name</Label>
              <Input
                id="name"
                value={newLocation.name}
                onChange={(e) => setNewLocation({ ...newLocation, name: e.target.value })}
                className="col-span-3"
                placeholder="Enter location name"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="type" className="text-right">Type</Label>
              <Select onValueChange={(value) => setNewLocation({ ...newLocation, type: value })}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select location type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="city">City</SelectItem>
                  <SelectItem value="town">Town</SelectItem>
                  <SelectItem value="village">Village</SelectItem>
                  <SelectItem value="dungeon">Dungeon</SelectItem>
                  <SelectItem value="forest">Forest</SelectItem>
                  <SelectItem value="mountain">Mountain</SelectItem>
                  <SelectItem value="castle">Castle</SelectItem>
                  <SelectItem value="tavern">Tavern</SelectItem>
                  <SelectItem value="temple">Temple</SelectItem>
                  <SelectItem value="ruins">Ruins</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="description" className="text-right">Description</Label>
              <Textarea
                id="description"
                value={newLocation.description}
                onChange={(e) => setNewLocation({ ...newLocation, description: e.target.value })}
                className="col-span-3"
                placeholder="Describe this location..."
                rows={3}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="notes" className="text-right">DM Notes</Label>
              <Textarea
                id="notes"
                value={newLocation.notes}
                onChange={(e) => setNewLocation({ ...newLocation, notes: e.target.value })}
                className="col-span-3"
                placeholder="Private notes for DM use..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateLocation}
              disabled={createLocationMutation.isPending}
            >
              {createLocationMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Location
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {locationsLoading ? (
          <div className="col-span-full flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-2">Loading locations...</span>
          </div>
        ) : (
          <>
            {locations.map((location) => (
              <Card key={location.id}>
                <CardHeader>
                  <CardTitle className="font-fantasy">{location.name}</CardTitle>
                  <CardDescription>{location.environment || location.type}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="aspect-video bg-muted/50 rounded-md flex items-center justify-center mb-3">
                    <MapPin className="h-12 w-12 text-muted-foreground" />
                  </div>
                  <p className="text-sm">{location.description}</p>
                  {location.notable_features && Array.isArray(location.notable_features) && location.notable_features.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs font-medium text-muted-foreground">Notable Features:</p>
                      <p className="text-xs text-muted-foreground">{location.notable_features.join(", ")}</p>
                    </div>
                  )}
                </CardContent>
                <CardFooter className="flex justify-between">
                  <Button variant="outline" size="sm">View Details</Button>
                  <Button size="sm">Edit Location</Button>
                </CardFooter>
              </Card>
            ))}
          </>
        )}
        
        <Card className="border-dashed bg-muted/10">
          <CardHeader>
            <CardTitle className="font-fantasy text-muted-foreground">Create New Location</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center h-40">
            <Plus className="h-12 w-12 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Add a new location for your adventures</p>
          </CardContent>
          <CardFooter>
            <Button className="w-full">
              <Plus className="h-4 w-4 mr-2" /> Create Location
            </Button>
          </CardFooter>
        </Card>
      </div>
      
      <Card className="bg-muted/30">
        <CardHeader>
          <CardTitle className="font-fantasy">Location Building Guide</CardTitle>
          <CardDescription>Tips for creating memorable locations</CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="multiple" className="w-full">
            <AccordionItem value="item-1">
              <AccordionTrigger className="font-medium">Key Elements of a Great D&D Location</AccordionTrigger>
              <AccordionContent className="space-y-2 text-sm">
                <p>Great D&D locations combine several elements to make them memorable and useful:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>A clear <span className="font-medium">purpose</span> within your world</li>
                  <li>Distinctive <span className="font-medium">visual features</span> you can describe vividly</li>
                  <li>Interesting <span className="font-medium">NPCs</span> who inhabit or are connected to it</li>
                  <li>Potential <span className="font-medium">conflicts</span> or story hooks</li>
                  <li>A sense of <span className="font-medium">history</span> that adds depth</li>
                </ul>
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="item-2">
              <AccordionTrigger className="font-medium">Types of Locations to Consider</AccordionTrigger>
              <AccordionContent className="space-y-2 text-sm">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <p className="font-medium flex items-center">
                      <Castle className="h-4 w-4 mr-1" /> Settlements
                    </p>
                    <ul className="list-disc list-inside ml-2 text-muted-foreground">
                      <li>Cities, towns, villages</li>
                      <li>Trading posts, outposts</li>
                      <li>Hidden communities</li>
                    </ul>
                  </div>
                  
                  <div className="space-y-1">
                    <p className="font-medium flex items-center">
                      <Landmark className="h-4 w-4 mr-1" /> Landmarks
                    </p>
                    <ul className="list-disc list-inside ml-2 text-muted-foreground">
                      <li>Ancient monuments</li>
                      <li>Magical locations</li>
                      <li>Natural wonders</li>
                    </ul>
                  </div>
                  
                  <div className="space-y-1">
                    <p className="font-medium flex items-center">
                      <Mountain className="h-4 w-4 mr-1" /> Wilderness
                    </p>
                    <ul className="list-disc list-inside ml-2 text-muted-foreground">
                      <li>Forests, mountains, deserts</li>
                      <li>Plains, swamps, tundra</li>
                      <li>Magical or corrupted regions</li>
                    </ul>
                  </div>
                  
                  <div className="space-y-1">
                    <p className="font-medium flex items-center">
                      <Droplets className="h-4 w-4 mr-1" /> Waterways
                    </p>
                    <ul className="list-disc list-inside ml-2 text-muted-foreground">
                      <li>Rivers, lakes, and seas</li>
                      <li>Coastal regions</li>
                      <li>Underwater locations</li>
                    </ul>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="item-3">
              <AccordionTrigger className="font-medium">Bringing Locations to Life</AccordionTrigger>
              <AccordionContent className="space-y-3 text-sm">
                <p>To make your locations memorable, engage the players' senses:</p>
                
                <div className="space-y-1">
                  <p className="font-medium">Visual Details</p>
                  <p className="text-muted-foreground">Describe architecture, notable features, colors, lighting, and atmosphere.</p>
                </div>
                
                <div className="space-y-1">
                  <p className="font-medium">Sounds</p>
                  <p className="text-muted-foreground">Include ambient noises, local music, or distinctive sounds unique to the location.</p>
                </div>
                
                <div className="space-y-1">
                  <p className="font-medium">Smells</p>
                  <p className="text-muted-foreground">Often overlooked but powerfully evocative - markets have spices, taverns have food and ale, swamps have decay.</p>
                </div>
                
                <div className="space-y-1">
                  <p className="font-medium">Textures and Sensations</p>
                  <p className="text-muted-foreground">The smoothness of worn stone, the clamminess of a cave, the heat of a desert.</p>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}

function QuestsTab() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newQuest, setNewQuest] = useState({
    title: "",
    description: "",
    category: "",
    difficulty: "",
    level_range: "",
    estimated_duration: "",
    notes: ""
  });
  const { toast } = useToast();

  // Fetch quests from the API
  const { data: quests = [], isLoading: questsLoading } = useQuery<any[]>({
    queryKey: ["/api/quests"],
  });

  const createQuestMutation = useMutation({
    mutationFn: async (questData: any) => {
      return await apiRequest("POST", "/api/quests", questData);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Quest created successfully",
      });
      setShowCreateDialog(false);
      setNewQuest({ title: "", description: "", category: "", difficulty: "", level_range: "", estimated_duration: "", notes: "" });
      queryClient.invalidateQueries({ queryKey: ["/api/quests"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCreateQuest = () => {
    if (!newQuest.title.trim() || !newQuest.description.trim()) {
      toast({
        title: "Error",
        description: "Quest title and description are required",
        variant: "destructive",
      });
      return;
    }
    createQuestMutation.mutate(newQuest);
  };

  const aiGenerateQuestMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/ai-generate/quest", {});
      return await response.json();
    },
    onSuccess: (data) => {
      setNewQuest({
        title: data.title || "",
        description: data.description || "",
        category: data.category || "",
        difficulty: data.difficulty || "",
        level_range: data.level_range || "",
        estimated_duration: data.estimated_duration || "",
        notes: data.notes || ""
      });
      setShowCreateDialog(true);
      toast({
        title: "Success",
        description: "AI generated quest ready for review",
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

  const handleAIGenerate = (type: string) => {
    if (type === 'quest') {
      aiGenerateQuestMutation.mutate();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-fantasy font-semibold">Quests & Adventures</h2>
          <p className="text-muted-foreground">Design quests and adventures for your campaigns</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" /> Create Quest
          </Button>
          <Button variant="outline" onClick={() => handleAIGenerate('quest')}>
            <Sparkles className="h-4 w-4 mr-2" /> AI Generate
          </Button>
        </div>
      </div>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Create New Quest</DialogTitle>
            <DialogDescription>
              Design a new quest or adventure for your campaign
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="title" className="text-right">Title</Label>
              <Input
                id="title"
                value={newQuest.title}
                onChange={(e) => setNewQuest({ ...newQuest, title: e.target.value })}
                className="col-span-3"
                placeholder="Enter quest title"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="category" className="text-right">Category</Label>
              <Select onValueChange={(value) => setNewQuest({ ...newQuest, category: value })}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select quest category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="main">Main Quest</SelectItem>
                  <SelectItem value="side">Side Quest</SelectItem>
                  <SelectItem value="personal">Personal Quest</SelectItem>
                  <SelectItem value="faction">Faction Quest</SelectItem>
                  <SelectItem value="exploration">Exploration</SelectItem>
                  <SelectItem value="rescue">Rescue Mission</SelectItem>
                  <SelectItem value="investigation">Investigation</SelectItem>
                  <SelectItem value="dungeon">Dungeon Delve</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="difficulty" className="text-right">Difficulty</Label>
              <Select onValueChange={(value) => setNewQuest({ ...newQuest, difficulty: value })}>
                <SelectTrigger className="col-span-3">
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
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="level_range" className="text-right">Level Range</Label>
              <Input
                id="level_range"
                value={newQuest.level_range}
                onChange={(e) => setNewQuest({ ...newQuest, level_range: e.target.value })}
                className="col-span-3"
                placeholder="e.g., 1-3, 4-6, 7-10"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="estimated_duration" className="text-right">Duration</Label>
              <Select onValueChange={(value) => setNewQuest({ ...newQuest, estimated_duration: value })}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select estimated duration" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1 session">1 Session</SelectItem>
                  <SelectItem value="2-3 sessions">2-3 Sessions</SelectItem>
                  <SelectItem value="4-6 sessions">4-6 Sessions</SelectItem>
                  <SelectItem value="1-2 months">1-2 Months</SelectItem>
                  <SelectItem value="long campaign">Long Campaign</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="description" className="text-right">Description</Label>
              <Textarea
                id="description"
                value={newQuest.description}
                onChange={(e) => setNewQuest({ ...newQuest, description: e.target.value })}
                className="col-span-3"
                placeholder="Describe the quest objective and story..."
                rows={4}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="notes" className="text-right">DM Notes</Label>
              <Textarea
                id="notes"
                value={newQuest.notes}
                onChange={(e) => setNewQuest({ ...newQuest, notes: e.target.value })}
                className="col-span-3"
                placeholder="Private notes, plot twists, rewards..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateQuest}
              disabled={createQuestMutation.isPending}
            >
              {createQuestMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Quest
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {questsLoading ? (
          <div className="col-span-full flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-2">Loading quests...</span>
          </div>
        ) : (
          <>
            {quests.map((quest) => (
              <Card key={quest.id}>
                <CardHeader>
                  <div className="flex justify-between">
                    <CardTitle className="font-fantasy">{quest.title}</CardTitle>
                    {quest.level_range && <Badge>{quest.level_range}</Badge>}
                  </div>
                  <CardDescription>{quest.category}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm mb-3">{quest.description}</p>
                  <div className="space-y-2">
                    {quest.difficulty && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Difficulty:</span>
                        <span>{quest.difficulty}</span>
                      </div>
                    )}
                    {quest.estimated_duration && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Estimated Duration:</span>
                        <span>{quest.estimated_duration}</span>
                      </div>
                    )}
                    {quest.status && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Status:</span>
                        <Badge variant={quest.status === 'completed' ? 'default' : 'secondary'}>
                          {quest.status}
                        </Badge>
                      </div>
                    )}
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between">
                  <Button variant="outline" size="sm">View Details</Button>
                  <Button size="sm">Edit Quest</Button>
                </CardFooter>
              </Card>
            ))}
          </>
        )}
        
        <Card className="border-dashed bg-muted/10">
          <CardHeader>
            <CardTitle className="font-fantasy text-muted-foreground">Create New Quest</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center h-48">
            <Plus className="h-12 w-12 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Design a new quest for your campaign</p>
          </CardContent>
          <CardFooter>
            <Button className="w-full">
              <Plus className="h-4 w-4 mr-2" /> Create Quest
            </Button>
          </CardFooter>
        </Card>
      </div>
      
      <Card className="bg-muted/30">
        <CardHeader>
          <CardTitle className="font-fantasy">Quest Design Fundamentals</CardTitle>
          <CardDescription>Guidelines for creating engaging quests</CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="multiple" className="w-full">
            <AccordionItem value="item-1">
              <AccordionTrigger className="font-medium">The 5 Elements of a Compelling Quest</AccordionTrigger>
              <AccordionContent className="space-y-2 text-sm">
                <p>Every great quest should include:</p>
                <div className="space-y-2 mt-2">
                  <div className="space-y-1">
                    <p className="font-medium">1. A Clear Goal</p>
                    <p className="text-muted-foreground">What exactly needs to be accomplished? Make the objective specific and understandable.</p>
                  </div>
                  
                  <div className="space-y-1">
                    <p className="font-medium">2. Meaningful Stakes</p>
                    <p className="text-muted-foreground">What happens if the characters succeed or fail? Make the consequences matter to them or the world.</p>
                  </div>
                  
                  <div className="space-y-1">
                    <p className="font-medium">3. Interesting Obstacles</p>
                    <p className="text-muted-foreground">What stands in their way? Include a mix of combat, social, and environmental challenges.</p>
                  </div>
                  
                  <div className="space-y-1">
                    <p className="font-medium">4. Moral Choices</p>
                    <p className="text-muted-foreground">What difficult decisions might they face? The best quests challenge players' values.</p>
                  </div>
                  
                  <div className="space-y-1">
                    <p className="font-medium">5. Rewarding Conclusion</p>
                    <p className="text-muted-foreground">What do the characters gain? Include tangible rewards (treasure, items) and intangible ones (reputation, information).</p>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="item-2">
              <AccordionTrigger className="font-medium">Quest Structure Patterns</AccordionTrigger>
              <AccordionContent className="space-y-3 text-sm">
                <p>These common structures provide a framework for your quests:</p>
                
                <div className="space-y-1">
                  <p className="font-medium">The Fetch Quest</p>
                  <p className="text-muted-foreground">Retrieve an object from a dangerous location, contending with guardians and traps.</p>
                </div>
                
                <div className="space-y-1">
                  <p className="font-medium">The Investigation</p>
                  <p className="text-muted-foreground">Gather clues, interrogate witnesses, and piece together information to solve a mystery.</p>
                </div>
                
                <div className="space-y-1">
                  <p className="font-medium">The Escort Mission</p>
                  <p className="text-muted-foreground">Protect an NPC or object while traveling through hostile territory.</p>
                </div>
                
                <div className="space-y-1">
                  <p className="font-medium">The Defense</p>
                  <p className="text-muted-foreground">Prepare for and repel an incoming attack on a location.</p>
                </div>
                
                <div className="space-y-1">
                  <p className="font-medium">The Diplomacy Mission</p>
                  <p className="text-muted-foreground">Negotiate between conflicting parties to achieve a desired outcome.</p>
                </div>
                
                <div className="space-y-1">
                  <p className="font-medium">The Monster Hunt</p>
                  <p className="text-muted-foreground">Track down and defeat a creature that's causing problems.</p>
                </div>
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="item-3">
              <AccordionTrigger className="font-medium">Adding Depth and Twists</AccordionTrigger>
              <AccordionContent className="space-y-3 text-sm">
                <p>Elevate your quests with these techniques:</p>
                
                <div className="space-y-1">
                  <p className="font-medium">The Unexpected Reversal</p>
                  <p className="text-muted-foreground">The seemingly villainous faction turns out to be justified, or the quest-giver has ulterior motives.</p>
                </div>
                
                <div className="space-y-1">
                  <p className="font-medium">Hidden Connections</p>
                  <p className="text-muted-foreground">The current quest ties into a character's backstory or a larger campaign arc in a surprising way.</p>
                </div>
                
                <div className="space-y-1">
                  <p className="font-medium">Moral Dilemmas</p>
                  <p className="text-muted-foreground">Force difficult choices with no clear right answer, where any decision has consequences.</p>
                </div>
                
                <div className="space-y-1">
                  <p className="font-medium">Time Pressure</p>
                  <p className="text-muted-foreground">Add urgency with a countdown, changing conditions, or competing parties after the same goal.</p>
                </div>
                
                <div className="space-y-1">
                  <p className="font-medium">Unintended Consequences</p>
                  <p className="text-muted-foreground">The party's actions cause unforeseen effects that lead to new problems or quests.</p>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}

function MagicItemsTab() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newItem, setNewItem] = useState({
    name: "",
    type: "",
    rarity: "",
    description: "",
    requires_attunement: false,
    notes: ""
  });
  const { toast } = useToast();

  // Fetch magic items from the API
  const { data: magicItems = [], isLoading: magicItemsLoading } = useQuery<any[]>({
    queryKey: ["/api/magic-items"],
  });

  const createItemMutation = useMutation({
    mutationFn: async (itemData: any) => {
      return await apiRequest("POST", "/api/magic-items", itemData);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Magic item created successfully",
      });
      setShowCreateDialog(false);
      setNewItem({ name: "", type: "", rarity: "", description: "", requires_attunement: false, notes: "" });
      queryClient.invalidateQueries({ queryKey: ["/api/magic-items"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCreateItem = () => {
    if (!newItem.name.trim() || !newItem.description.trim()) {
      toast({
        title: "Error",
        description: "Item name and description are required",
        variant: "destructive",
      });
      return;
    }
    createItemMutation.mutate(newItem);
  };

  const aiGenerateItemMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/ai-generate/magic-item", {});
      return await response.json();
    },
    onSuccess: (data) => {
      setNewItem({
        name: data.name || "",
        type: data.type || "",
        rarity: data.rarity || "",
        description: data.description || "",
        requires_attunement: data.requires_attunement || false,
        notes: data.notes || ""
      });
      setShowCreateDialog(true);
      toast({
        title: "Success",
        description: "AI generated magic item ready for review",
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

  const handleAIGenerate = (type: string) => {
    if (type === 'magic-item') {
      aiGenerateItemMutation.mutate();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-fantasy font-semibold">Magic Items</h2>
          <p className="text-muted-foreground">Create and manage magical items for your campaigns</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" /> Create Magic Item
          </Button>
          <Button variant="outline" onClick={() => handleAIGenerate('magic-item')}>
            <Sparkles className="h-4 w-4 mr-2" /> AI Generate
          </Button>
        </div>
      </div>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Create New Magic Item</DialogTitle>
            <DialogDescription>
              Design a new magical item for your campaign
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">Name</Label>
              <Input
                id="name"
                value={newItem.name}
                onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                className="col-span-3"
                placeholder="Enter item name"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="type" className="text-right">Type</Label>
              <Select onValueChange={(value) => setNewItem({ ...newItem, type: value })}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select item type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weapon">Weapon</SelectItem>
                  <SelectItem value="armor">Armor</SelectItem>
                  <SelectItem value="shield">Shield</SelectItem>
                  <SelectItem value="wondrous">Wondrous Item</SelectItem>
                  <SelectItem value="potion">Potion</SelectItem>
                  <SelectItem value="scroll">Scroll</SelectItem>
                  <SelectItem value="wand">Wand</SelectItem>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="rod">Rod</SelectItem>
                  <SelectItem value="ring">Ring</SelectItem>
                  <SelectItem value="amulet">Amulet</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="rarity" className="text-right">Rarity</Label>
              <Select onValueChange={(value) => setNewItem({ ...newItem, rarity: value })}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select rarity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="common">Common</SelectItem>
                  <SelectItem value="uncommon">Uncommon</SelectItem>
                  <SelectItem value="rare">Rare</SelectItem>
                  <SelectItem value="very rare">Very Rare</SelectItem>
                  <SelectItem value="legendary">Legendary</SelectItem>
                  <SelectItem value="artifact">Artifact</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="description" className="text-right">Description</Label>
              <Textarea
                id="description"
                value={newItem.description}
                onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                className="col-span-3"
                placeholder="Describe the item's appearance and magical properties..."
                rows={4}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="attunement" className="text-right">Attunement</Label>
              <div className="col-span-3">
                <Checkbox
                  id="attunement"
                  checked={newItem.requires_attunement}
                  onCheckedChange={(checked) => setNewItem({ ...newItem, requires_attunement: checked as boolean })}
                />
                <Label htmlFor="attunement" className="ml-2 text-sm">Requires Attunement</Label>
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="notes" className="text-right">DM Notes</Label>
              <Textarea
                id="notes"
                value={newItem.notes}
                onChange={(e) => setNewItem({ ...newItem, notes: e.target.value })}
                className="col-span-3"
                placeholder="Private notes, balancing considerations, lore..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateItem}
              disabled={createItemMutation.isPending}
            >
              {createItemMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Item
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {magicItemsLoading ? (
          <div className="col-span-full flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-2">Loading magic items...</span>
          </div>
        ) : (
          <>
            {magicItems.map((item) => (
              <Card key={item.id}>
                <CardHeader className="pb-3">
                  <div className="flex justify-between">
                    <CardTitle className="font-fantasy">{item.name}</CardTitle>
                    {item.rarity && <Badge variant="outline">{item.rarity}</Badge>}
                  </div>
                  <CardDescription>{item.type}{item.requires_attunement ? ', requires attunement' : ''}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-center mb-3">
                    <div className="w-20 h-20 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                      <Sparkles className="h-10 w-10 text-purple-500" />
                    </div>
                  </div>
                  <p className="text-sm mb-3">{item.description}</p>
                  {item.requires_attunement && (
                    <>
                      <Separator className="my-2" />
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>Requires attunement</span>
                      </div>
                    </>
                  )}
                </CardContent>
                <CardFooter className="flex justify-between">
                  <Button variant="outline" size="sm">View Details</Button>
                  <Button size="sm">Edit Item</Button>
                </CardFooter>
              </Card>
            ))}
          </>
        )}
        
        <Card className="border-dashed bg-muted/10">
          <CardHeader>
            <CardTitle className="font-fantasy text-muted-foreground">Create New Magic Item</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center h-48">
            <Plus className="h-12 w-12 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Design a new magical item for your campaign</p>
          </CardContent>
          <CardFooter>
            <Button className="w-full">
              <Plus className="h-4 w-4 mr-2" /> Create Magic Item
            </Button>
          </CardFooter>
        </Card>
      </div>
      
      <Card className="bg-muted/30">
        <CardHeader>
          <CardTitle className="font-fantasy">Magic Item Design Guide</CardTitle>
          <CardDescription>Principles for creating balanced and interesting magic items</CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="multiple" className="w-full">
            <AccordionItem value="item-1">
              <AccordionTrigger className="font-medium">Rarity and Power Guidelines</AccordionTrigger>
              <AccordionContent className="space-y-3 text-sm">
                <p>Magic item power should generally correspond to its rarity:</p>
                
                <div className="space-y-1">
                  <p className="font-medium">Common</p>
                  <p className="text-muted-foreground">Minor magical properties with primarily non-combat benefits. Examples: Ever-burning torch, self-cleaning clothes.</p>
                </div>
                
                <div className="space-y-1">
                  <p className="font-medium">Uncommon</p>
                  <p className="text-muted-foreground">Modest bonuses (+1 weapons/armor) or useful utility abilities. Examples: Bag of holding, potion of healing.</p>
                </div>
                
                <div className="space-y-1">
                  <p className="font-medium">Rare</p>
                  <p className="text-muted-foreground">Significant bonuses (+2 weapons/armor) or powerful situational abilities. Examples: Ring of protection, cloak of elvenkind.</p>
                </div>
                
                <div className="space-y-1">
                  <p className="font-medium">Very Rare</p>
                  <p className="text-muted-foreground">Strong bonuses (+3 weapons/armor) or potent abilities usable frequently. Examples: Staff of power, manual of bodily health.</p>
                </div>
                
                <div className="space-y-1">
                  <p className="font-medium">Legendary</p>
                  <p className="text-muted-foreground">Game-changing abilities that can significantly alter encounters or gameplay. Examples: Vorpal sword, staff of the magi.</p>
                </div>
                
                <div className="space-y-1">
                  <p className="font-medium">Artifact</p>
                  <p className="text-muted-foreground">Unique items of immense power with historical significance. Examples: Book of vile darkness, eye and hand of Vecna.</p>
                </div>
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="item-2">
              <AccordionTrigger className="font-medium">Making Memorable Magic Items</AccordionTrigger>
              <AccordionContent className="space-y-3 text-sm">
                <p>The most memorable magic items have these features:</p>
                
                <div className="space-y-1">
                  <p className="font-medium">Distinctive Appearance</p>
                  <p className="text-muted-foreground">Describe unique visual elements, materials, or magical effects that make the item instantly recognizable.</p>
                </div>
                
                <div className="space-y-1">
                  <p className="font-medium">Thematic Coherence</p>
                  <p className="text-muted-foreground">All abilities should tie into a central theme or concept that makes sense together.</p>
                </div>
                
                <div className="space-y-1">
                  <p className="font-medium">History and Lore</p>
                  <p className="text-muted-foreground">Give important items a backstory that players can discover, connecting them to your world.</p>
                </div>
                
                <div className="space-y-1">
                  <p className="font-medium">Meaningful Tradeoffs</p>
                  <p className="text-muted-foreground">Consider adding drawbacks, limitations, or costs to use powerful abilities.</p>
                </div>
                
                <div className="space-y-1">
                  <p className="font-medium">Character Growth</p>
                  <p className="text-muted-foreground">Items that can grow with the character or unlock new abilities as certain conditions are met.</p>
                </div>
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="item-3">
              <AccordionTrigger className="font-medium">Types of Magic Items</AccordionTrigger>
              <AccordionContent className="space-y-3 text-sm">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <p className="font-medium">Weapons</p>
                    <p className="text-muted-foreground">Consider bonuses to attack/damage, additional damage types, special abilities against certain enemies, and activated powers.</p>
                  </div>
                  
                  <div className="space-y-1">
                    <p className="font-medium">Armor & Shields</p>
                    <p className="text-muted-foreground">AC bonuses, damage resistance, environmental protections, and special reactions to attacks.</p>
                  </div>
                  
                  <div className="space-y-1">
                    <p className="font-medium">Wondrous Items</p>
                    <p className="text-muted-foreground">The most diverse category, including clothing, accessories, and miscellaneous objects with various magical properties.</p>
                  </div>
                  
                  <div className="space-y-1">
                    <p className="font-medium">Potions & Scrolls</p>
                    <p className="text-muted-foreground">Consumable items that provide temporary effects or one-time spell casting abilities.</p>
                  </div>
                  
                  <div className="space-y-1">
                    <p className="font-medium">Staffs, Wands & Rods</p>
                    <p className="text-muted-foreground">Items that store magical energy and can cast specific spells or produce magical effects multiple times.</p>
                  </div>
                  
                  <div className="space-y-1">
                    <p className="font-medium">Rings & Amulets</p>
                    <p className="text-muted-foreground">Typically provide passive benefits or protections while worn, often requiring attunement.</p>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}

function MonstersTab() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newMonster, setNewMonster] = useState({
    name: "",
    size: "",
    type: "",
    alignment: "",
    challenge_rating: "",
    armor_class: 10,
    hit_points: 10,
    speed: "",
    strength: 10,
    dexterity: 10,
    constitution: 10,
    intelligence: 10,
    wisdom: 10,
    charisma: 10,
    description: "",
    notes: ""
  });
  const { toast } = useToast();

  // Fetch monsters from the API
  const { data: monsters = [], isLoading: monstersLoading } = useQuery<any[]>({
    queryKey: ["/api/monsters"],
  });

  const createMonsterMutation = useMutation({
    mutationFn: async (monsterData: any) => {
      return await apiRequest("POST", "/api/monsters", monsterData);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Monster created successfully",
      });
      setShowCreateDialog(false);
      setNewMonster({
        name: "", size: "", type: "", alignment: "", challenge_rating: "", armor_class: 10,
        hit_points: 10, speed: "", strength: 10, dexterity: 10, constitution: 10,
        intelligence: 10, wisdom: 10, charisma: 10, description: "", notes: ""
      });
      queryClient.invalidateQueries({ queryKey: ["/api/monsters"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCreateMonster = () => {
    if (!newMonster.name.trim() || !newMonster.size || !newMonster.type) {
      toast({
        title: "Error",
        description: "Monster name, size, and type are required",
        variant: "destructive",
      });
      return;
    }
    createMonsterMutation.mutate(newMonster);
  };

  const aiGenerateMonsterMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/ai-generate/monster", {});
      return await response.json();
    },
    onSuccess: (data) => {
      setNewMonster({
        name: data.name || "",
        size: data.size || "",
        type: data.type || "",
        alignment: data.alignment || "",
        challenge_rating: data.challenge_rating || "",
        armor_class: data.armor_class || 10,
        hit_points: data.hit_points || 1,
        speed: data.speed || "",
        strength: data.strength || 10,
        dexterity: data.dexterity || 10,
        constitution: data.constitution || 10,
        intelligence: data.intelligence || 10,
        wisdom: data.wisdom || 10,
        charisma: data.charisma || 10,
        description: data.description || "",
        notes: data.notes || ""
      });
      setShowCreateDialog(true);
      toast({
        title: "Success",
        description: "AI generated monster ready for review",
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

  const handleAIGenerate = (type: string) => {
    if (type === 'monster') {
      aiGenerateMonsterMutation.mutate();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-fantasy font-semibold">Monster Creation</h2>
          <p className="text-muted-foreground">Design unique monsters and creatures for your campaigns</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" /> Create Monster
          </Button>
          <Button variant="outline" onClick={() => handleAIGenerate('monster')}>
            <Sparkles className="h-4 w-4 mr-2" /> AI Generate
          </Button>
        </div>
      </div>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Monster</DialogTitle>
            <DialogDescription>
              Design a new creature for your campaign
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-6 gap-4">
              <div className="col-span-3">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={newMonster.name}
                  onChange={(e) => setNewMonster({ ...newMonster, name: e.target.value })}
                  placeholder="Enter monster name"
                />
              </div>
              <div className="col-span-1">
                <Label htmlFor="size">Size</Label>
                <Select onValueChange={(value) => setNewMonster({ ...newMonster, size: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Size" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tiny">Tiny</SelectItem>
                    <SelectItem value="small">Small</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="large">Large</SelectItem>
                    <SelectItem value="huge">Huge</SelectItem>
                    <SelectItem value="gargantuan">Gargantuan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label htmlFor="type">Type</Label>
                <Select onValueChange={(value) => setNewMonster({ ...newMonster, type: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Creature Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="beast">Beast</SelectItem>
                    <SelectItem value="humanoid">Humanoid</SelectItem>
                    <SelectItem value="undead">Undead</SelectItem>
                    <SelectItem value="fiend">Fiend</SelectItem>
                    <SelectItem value="celestial">Celestial</SelectItem>
                    <SelectItem value="fey">Fey</SelectItem>
                    <SelectItem value="dragon">Dragon</SelectItem>
                    <SelectItem value="elemental">Elemental</SelectItem>
                    <SelectItem value="aberration">Aberration</SelectItem>
                    <SelectItem value="construct">Construct</SelectItem>
                    <SelectItem value="giant">Giant</SelectItem>
                    <SelectItem value="monstrosity">Monstrosity</SelectItem>
                    <SelectItem value="ooze">Ooze</SelectItem>
                    <SelectItem value="plant">Plant</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-6 gap-4">
              <div className="col-span-2">
                <Label htmlFor="alignment">Alignment</Label>
                <Input
                  id="alignment"
                  value={newMonster.alignment}
                  onChange={(e) => setNewMonster({ ...newMonster, alignment: e.target.value })}
                  placeholder="e.g., Chaotic Evil"
                />
              </div>
              <div className="col-span-1">
                <Label htmlFor="cr">Challenge Rating</Label>
                <Input
                  id="cr"
                  value={newMonster.challenge_rating}
                  onChange={(e) => setNewMonster({ ...newMonster, challenge_rating: e.target.value })}
                  placeholder="e.g., 1/4, 2, 10"
                />
              </div>
              <div className="col-span-1">
                <Label htmlFor="ac">Armor Class</Label>
                <Input
                  id="ac"
                  type="number"
                  value={newMonster.armor_class}
                  onChange={(e) => setNewMonster({ ...newMonster, armor_class: parseInt(e.target.value) || 10 })}
                />
              </div>
              <div className="col-span-1">
                <Label htmlFor="hp">Hit Points</Label>
                <Input
                  id="hp"
                  type="number"
                  value={newMonster.hit_points}
                  onChange={(e) => setNewMonster({ ...newMonster, hit_points: parseInt(e.target.value) || 10 })}
                />
              </div>
              <div className="col-span-1">
                <Label htmlFor="speed">Speed</Label>
                <Input
                  id="speed"
                  value={newMonster.speed}
                  onChange={(e) => setNewMonster({ ...newMonster, speed: e.target.value })}
                  placeholder="30 ft."
                />
              </div>
            </div>

            <div className="grid grid-cols-6 gap-4">
              <div>
                <Label htmlFor="str">STR</Label>
                <Input
                  id="str"
                  type="number"
                  value={newMonster.strength}
                  onChange={(e) => setNewMonster({ ...newMonster, strength: parseInt(e.target.value) || 10 })}
                />
              </div>
              <div>
                <Label htmlFor="dex">DEX</Label>
                <Input
                  id="dex"
                  type="number"
                  value={newMonster.dexterity}
                  onChange={(e) => setNewMonster({ ...newMonster, dexterity: parseInt(e.target.value) || 10 })}
                />
              </div>
              <div>
                <Label htmlFor="con">CON</Label>
                <Input
                  id="con"
                  type="number"
                  value={newMonster.constitution}
                  onChange={(e) => setNewMonster({ ...newMonster, constitution: parseInt(e.target.value) || 10 })}
                />
              </div>
              <div>
                <Label htmlFor="int">INT</Label>
                <Input
                  id="int"
                  type="number"
                  value={newMonster.intelligence}
                  onChange={(e) => setNewMonster({ ...newMonster, intelligence: parseInt(e.target.value) || 10 })}
                />
              </div>
              <div>
                <Label htmlFor="wis">WIS</Label>
                <Input
                  id="wis"
                  type="number"
                  value={newMonster.wisdom}
                  onChange={(e) => setNewMonster({ ...newMonster, wisdom: parseInt(e.target.value) || 10 })}
                />
              </div>
              <div>
                <Label htmlFor="cha">CHA</Label>
                <Input
                  id="cha"
                  type="number"
                  value={newMonster.charisma}
                  onChange={(e) => setNewMonster({ ...newMonster, charisma: parseInt(e.target.value) || 10 })}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={newMonster.description}
                onChange={(e) => setNewMonster({ ...newMonster, description: e.target.value })}
                placeholder="Describe the monster's appearance and behavior..."
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="notes">DM Notes</Label>
              <Textarea
                id="notes"
                value={newMonster.notes}
                onChange={(e) => setNewMonster({ ...newMonster, notes: e.target.value })}
                placeholder="Combat tactics, lore, special considerations..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateMonster}
              disabled={createMonsterMutation.isPending}
            >
              {createMonsterMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Monster
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
          {monstersLoading ? (
            <div className="col-span-full flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="ml-2">Loading monsters...</span>
            </div>
          ) : (
            <>
              {monsters.map((monster) => (
                <Card key={monster.id}>
                  <CardHeader className="pb-2">
                    <div className="flex justify-between">
                      <CardTitle className="font-fantasy">{monster.name}</CardTitle>
                      {monster.challenge_rating && <Badge>CR {monster.challenge_rating}</Badge>}
                    </div>
                    <CardDescription>{monster.size} {monster.type}, {monster.alignment}</CardDescription>
                  </CardHeader>
                  <CardContent className="pb-0">
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <div>
                          <span className="font-medium">Armor Class:</span> {monster.armor_class}
                        </div>
                        <div>
                          <span className="font-medium">Hit Points:</span> {monster.hit_points}
                        </div>
                      </div>
                      
                      <div className="flex justify-between text-sm">
                        <div>
                          <span className="font-medium">Speed:</span> {monster.speed}
                        </div>
                        <div>
                          <span className="font-medium">Size:</span> {monster.size}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-6 gap-2 text-center text-sm mt-2">
                        <div className="space-y-1">
                          <div className="font-medium">STR</div>
                          <div className="bg-muted rounded-md py-1">{monster.strength} ({Math.floor((monster.strength - 10) / 2) >= 0 ? '+' : ''}{Math.floor((monster.strength - 10) / 2)})</div>
                        </div>
                        <div className="space-y-1">
                          <div className="font-medium">DEX</div>
                          <div className="bg-muted rounded-md py-1">{monster.dexterity} ({Math.floor((monster.dexterity - 10) / 2) >= 0 ? '+' : ''}{Math.floor((monster.dexterity - 10) / 2)})</div>
                        </div>
                        <div className="space-y-1">
                          <div className="font-medium">CON</div>
                          <div className="bg-muted rounded-md py-1">{monster.constitution} ({Math.floor((monster.constitution - 10) / 2) >= 0 ? '+' : ''}{Math.floor((monster.constitution - 10) / 2)})</div>
                        </div>
                        <div className="space-y-1">
                          <div className="font-medium">INT</div>
                          <div className="bg-muted rounded-md py-1">{monster.intelligence} ({Math.floor((monster.intelligence - 10) / 2) >= 0 ? '+' : ''}{Math.floor((monster.intelligence - 10) / 2)})</div>
                        </div>
                        <div className="space-y-1">
                          <div className="font-medium">WIS</div>
                          <div className="bg-muted rounded-md py-1">{monster.wisdom} ({Math.floor((monster.wisdom - 10) / 2) >= 0 ? '+' : ''}{Math.floor((monster.wisdom - 10) / 2)})</div>
                        </div>
                        <div className="space-y-1">
                          <div className="font-medium">CHA</div>
                          <div className="bg-muted rounded-md py-1">{monster.charisma} ({Math.floor((monster.charisma - 10) / 2) >= 0 ? '+' : ''}{Math.floor((monster.charisma - 10) / 2)})</div>
                        </div>
                      </div>
                      
                      {monster.description && (
                        <div className="space-y-1">
                          <div className="font-medium text-sm">Description</div>
                          <p className="text-sm text-muted-foreground">{monster.description}</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                  <CardFooter className="flex justify-between pt-3">
                    <Button variant="outline" size="sm">View Details</Button>
                    <Button size="sm">Edit Monster</Button>
                  </CardFooter>
                </Card>
              ))}
            </>
          )}
          
          <Card className="border-dashed bg-muted/10">
            <CardHeader>
              <CardTitle className="font-fantasy text-muted-foreground">Create New Monster</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center h-44">
              <Plus className="h-12 w-12 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Design a new monster for your campaign</p>
            </CardContent>
            <CardFooter>
              <Button className="w-full">
                <Plus className="h-4 w-4 mr-2" /> Create Monster
              </Button>
            </CardFooter>
          </Card>
        </div>
        
        <div className="space-y-6">
          <Card className="bg-muted/30">
            <CardHeader className="pb-3">
              <CardTitle className="font-fantasy text-base">Monster Stat Block Guide</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>When creating a monster, include these key components:</p>
              <p>• <span className="font-medium">Size, Type, and Alignment</span></p>
              <p>• <span className="font-medium">Armor Class, Hit Points, and Speed</span></p>
              <p>• <span className="font-medium">Ability Scores and Modifiers</span></p>
              <p>• <span className="font-medium">Saving Throws and Skills</span></p>
              <p>• <span className="font-medium">Vulnerabilities, Resistances, and Immunities</span></p>
              <p>• <span className="font-medium">Senses and Languages</span></p>
              <p>• <span className="font-medium">Challenge Rating (CR)</span></p>
              <p>• <span className="font-medium">Special Traits</span></p>
              <p>• <span className="font-medium">Actions and Reactions</span></p>
              <p>• <span className="font-medium">Legendary/Lair Actions (if applicable)</span></p>
            </CardContent>
          </Card>
          
          <Card className="bg-muted/30">
            <CardHeader className="pb-3">
              <CardTitle className="font-fantasy text-base">Tips for Memorable Monsters</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>• Give your monster a distinctive appearance that players will remember</p>
              <p>• Include at least one unique ability that sets it apart from similar creatures</p>
              <p>• Consider the monster's role in the ecosystem and your adventure</p>
              <p>• Create interesting behavior patterns and tactics, not just stat blocks</p>
              <p>• For important encounters, add environmental elements that interact with the monster</p>
              <p>• Consider giving a boss monster multiple phases or forms as the battle progresses</p>
            </CardContent>
          </Card>
          
          <Card className="bg-muted/30">
            <CardHeader className="pb-3">
              <CardTitle className="font-fantasy text-base">Challenge Rating Guidelines</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="font-medium">CR 0-1</span>
                  <span className="text-muted-foreground">Easy for levels 1-3</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">CR 2-4</span>
                  <span className="text-muted-foreground">Challenging for levels 3-6</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">CR 5-8</span>
                  <span className="text-muted-foreground">Challenging for levels 7-10</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">CR 9-12</span>
                  <span className="text-muted-foreground">Challenging for levels 11-14</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">CR 13-16</span>
                  <span className="text-muted-foreground">Challenging for levels 15-18</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">CR 17+</span>
                  <span className="text-muted-foreground">Appropriate for levels 19-20</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

type QuestionOption = {
  value: string;
  label: string;
};

type Question = {
  id: string;
  text: string;
  type: "radio" | "checkbox" | "textarea";
  options?: QuestionOption[];
  placeholder?: string;
};

type WorkflowStep = {
  title: string;
  description: string;
  questions: Question[];
  guidance: string;
};

type Workflow = {
  id: string;
  title: string;
  description: string;
  icon: any;
  difficulty: string;
  duration: string;
  steps: WorkflowStep[];
};

function DMWorkflowAndGuidance() {
  const [activeWorkflow, setActiveWorkflow] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, any>>({});
  const [showDecisionTree, setShowDecisionTree] = useState(false);
  const [selectedDecisionType, setSelectedDecisionType] = useState<string | null>(null);
  const { toast } = useToast();

  const workflows = [
    {
      id: "campaign-creation",
      title: "Campaign Creation Workflow",
      description: "Step-by-step guide to creating your first D&D campaign",
      icon: BookOpen,
      difficulty: "Beginner",
      duration: "15-30 minutes",
      steps: [
        {
          title: "Choose Your Campaign Type",
          description: "Decide what kind of D&D experience you want to create",
          questions: [
            {
              id: "campaign-type",
              text: "What type of campaign appeals to you most?",
              type: "radio" as const,
              options: [
                { value: "sandbox", label: "Sandbox - Open world exploration" },
                { value: "linear", label: "Linear - Structured story path" },
                { value: "episodic", label: "Episodic - Self-contained adventures" },
                { value: "mystery", label: "Mystery - Investigation focused" }
              ]
            }
          ],
          guidance: "Your campaign type shapes how you prepare content and what tools you'll need most."
        },
        {
          title: "Define Your Setting",
          description: "Establish the world where your adventures will take place",
          questions: [
            {
              id: "setting-type",
              text: "What kind of setting interests you?",
              type: "radio",
              options: [
                { value: "published", label: "Published setting (Forgotten Realms, etc.)" },
                { value: "homebrew", label: "Original homebrew world" },
                { value: "modified", label: "Modified published setting" },
                { value: "real-world", label: "Real world with fantasy elements" }
              ]
            },
            {
              id: "tone",
              text: "What tone do you want for your campaign?",
              type: "radio",
              options: [
                { value: "heroic", label: "Heroic - Classic good vs evil" },
                { value: "gritty", label: "Gritty - Morally complex, realistic" },
                { value: "comedic", label: "Comedic - Light-hearted and fun" },
                { value: "horror", label: "Horror - Dark and frightening" }
              ]
            }
          ],
          guidance: "The setting and tone provide the foundation for all your storytelling decisions."
        },
        {
          title: "Plan Your Session Zero",
          description: "Prepare for the crucial first meeting with your players",
          questions: [
            {
              id: "safety-tools",
              text: "Which safety tools will you use?",
              type: "checkbox",
              options: [
                { value: "x-card", label: "X-Card system" },
                { value: "lines-veils", label: "Lines and Veils" },
                { value: "consent-checklist", label: "Consent checklist" },
                { value: "open-door", label: "Open door policy" }
              ]
            }
          ],
          guidance: "Session Zero sets expectations and ensures everyone has fun safely."
        }
      ]
    },
    {
      id: "session-prep",
      title: "Session Preparation Guide",
      description: "Efficient methods for preparing engaging D&D sessions",
      icon: Target,
      difficulty: "Intermediate",
      duration: "20-45 minutes",
      steps: [
        {
          title: "Review Previous Session",
          description: "Understand where your story currently stands",
          questions: [
            {
              id: "loose-threads",
              text: "What unresolved plot threads exist?",
              type: "textarea",
              placeholder: "List any ongoing mysteries, character arcs, or world events..."
            }
          ],
          guidance: "Always start by understanding what happened before and what players expect to continue."
        },
        {
          title: "Define Session Goals",
          description: "Set clear objectives for the upcoming session",
          questions: [
            {
              id: "session-type",
              text: "What's the primary focus of this session?",
              type: "radio",
              options: [
                { value: "combat", label: "Combat encounter" },
                { value: "roleplay", label: "Roleplay and character development" },
                { value: "exploration", label: "Exploration and discovery" },
                { value: "puzzle", label: "Puzzles and problem-solving" }
              ]
            }
          ],
          guidance: "Having a clear focus helps you prepare the right content and pacing."
        }
      ]
    },
    {
      id: "encounter-design",
      title: "Encounter Design Workshop",
      description: "Create memorable combat and non-combat encounters",
      icon: Swords,
      difficulty: "Intermediate",
      duration: "30-60 minutes",
      steps: [
        {
          title: "Choose Encounter Type",
          description: "Decide what kind of challenge to create",
          questions: [
            {
              id: "encounter-type",
              text: "What type of encounter are you designing?",
              type: "radio",
              options: [
                { value: "combat", label: "Combat encounter" },
                { value: "social", label: "Social interaction" },
                { value: "exploration", label: "Exploration challenge" },
                { value: "puzzle", label: "Puzzle or riddle" }
              ]
            }
          ],
          guidance: "Different encounter types require different preparation approaches."
        }
      ]
    }
  ];

  const decisionTrees = [
    {
      id: "player-conflict",
      title: "Handling Player Conflicts",
      description: "Navigate interpersonal issues at the table",
      scenarios: [
        {
          situation: "Two players are arguing about strategy",
          options: [
            { text: "Let them work it out", consequence: "May resolve naturally or escalate" },
            { text: "Call a 5-minute break", consequence: "Gives time to cool down" },
            { text: "Suggest compromise", consequence: "Shows leadership but may not satisfy both" }
          ]
        }
      ]
    },
    {
      id: "rules-disputes",
      title: "Rules Disputes at the Table",
      description: "Handle rules disagreements smoothly",
      scenarios: [
        {
          situation: "Player disagrees with your ruling",
          options: [
            { text: "Make a quick ruling and move on", consequence: "Keeps game flowing but may create resentment" },
            { text: "Look up the rule together", consequence: "Accurate but slows the game" },
            { text: "Ask player to accept ruling now, discuss after", consequence: "Good compromise approach" }
          ]
        }
      ]
    }
  ];

  const currentWorkflow = workflows.find(w => w.id === activeWorkflow);
  const currentWorkflowStep = currentWorkflow?.steps[currentStep];

  const handleWorkflowStart = (workflowId: string) => {
    setActiveWorkflow(workflowId);
    setCurrentStep(0);
    setUserAnswers({});
  };

  const handleAnswerChange = (questionId: string, value: any) => {
    setUserAnswers(prev => ({
      ...prev,
      [questionId]: value
    }));
  };

  const handleNextStep = () => {
    if (currentWorkflow && currentStep < currentWorkflow.steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      toast({
        title: "Workflow Complete!",
        description: "You've completed this DM guidance workflow.",
      });
      setActiveWorkflow(null);
      setCurrentStep(0);
      setUserAnswers({});
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  if (activeWorkflow && currentWorkflow) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="outline" onClick={() => setActiveWorkflow(null)}>
              <ChevronLeft className="h-4 w-4 mr-2" />
              Back to Workflows
            </Button>
            <div>
              <h2 className="text-2xl font-fantasy font-semibold">{currentWorkflow.title}</h2>
              <p className="text-muted-foreground">Step {currentStep + 1} of {currentWorkflow.steps.length}</p>
            </div>
          </div>
          <Badge variant="outline">{currentWorkflow.difficulty}</Badge>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Progress</span>
            <span>{Math.round(((currentStep + 1) / currentWorkflow.steps.length) * 100)}%</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div 
              className="bg-primary h-2 rounded-full transition-all duration-300"
              style={{ width: `${((currentStep + 1) / currentWorkflow.steps.length) * 100}%` }}
            />
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{currentWorkflowStep?.title}</CardTitle>
            <CardDescription>{currentWorkflowStep?.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {currentWorkflowStep?.questions.map((question) => (
              <div key={question.id} className="space-y-3">
                <Label className="text-base font-medium">{question.text}</Label>
                
                {question.type === "radio" && "options" in question && (
                  <div className="space-y-2">
                    {question.options.map((option) => (
                      <div key={option.value} className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id={`${question.id}-${option.value}`}
                          name={question.id}
                          value={option.value}
                          checked={userAnswers[question.id] === option.value}
                          onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                          className="text-primary"
                        />
                        <Label htmlFor={`${question.id}-${option.value}`} className="font-normal">
                          {option.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                )}

                {question.type === "checkbox" && "options" in question && (
                  <div className="space-y-2">
                    {question.options.map((option) => (
                      <div key={option.value} className="flex items-center space-x-2">
                        <Checkbox
                          id={`${question.id}-${option.value}`}
                          checked={(userAnswers[question.id] || []).includes(option.value)}
                          onCheckedChange={(checked) => {
                            const current = userAnswers[question.id] || [];
                            if (checked) {
                              handleAnswerChange(question.id, [...current, option.value]);
                            } else {
                              handleAnswerChange(question.id, current.filter((v: string) => v !== option.value));
                            }
                          }}
                        />
                        <Label htmlFor={`${question.id}-${option.value}`} className="font-normal">
                          {option.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                )}

                {question.type === "textarea" && "placeholder" in question && (
                  <Textarea
                    placeholder={question.placeholder}
                    value={userAnswers[question.id] || ""}
                    onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                    rows={4}
                  />
                )}
              </div>
            ))}

            {currentWorkflowStep?.guidance && (
              <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-start space-x-2">
                  <Lightbulb className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-blue-900 dark:text-blue-100">DM Tip</p>
                    <p className="text-sm text-blue-800 dark:text-blue-200">{currentWorkflowStep.guidance}</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button
              variant="outline"
              onClick={handlePrevStep}
              disabled={currentStep === 0}
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Previous
            </Button>
            <Button onClick={handleNextStep}>
              {currentStep === currentWorkflow.steps.length - 1 ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Complete
                </>
              ) : (
                <>
                  Next
                  <ChevronRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (showDecisionTree) {
    const selectedTree = decisionTrees.find(t => t.id === selectedDecisionType);
    
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="outline" onClick={() => setShowDecisionTree(false)}>
              <ChevronLeft className="h-4 w-4 mr-2" />
              Back to Decision Trees
            </Button>
            <div>
              <h2 className="text-2xl font-fantasy font-semibold">{selectedTree?.title}</h2>
              <p className="text-muted-foreground">{selectedTree?.description}</p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {selectedTree?.scenarios.map((scenario, index) => (
            <Card key={index}>
              <CardHeader>
                <CardTitle className="text-lg">Scenario {index + 1}</CardTitle>
                <CardDescription>{scenario.situation}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Label className="font-medium">Your options:</Label>
                  {scenario.options.map((option, optionIndex) => (
                    <div key={optionIndex} className="border rounded-lg p-4 space-y-2">
                      <p className="font-medium">{option.text}</p>
                      <p className="text-sm text-muted-foreground">
                        <span className="font-medium">Likely outcome:</span> {option.consequence}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-4">
        <h2 className="text-2xl font-fantasy font-semibold">DM Workflow & Guidance</h2>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Interactive tools to teach you the art of Dungeon Mastering and provide real-time assistance for every step of campaign creation and management.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setShowDecisionTree(true)}>
          <CardHeader>
            <CardTitle className="flex items-center text-lg">
              <Brain className="h-5 w-5 mr-2 text-purple-600" />
              Decision Trees
            </CardTitle>
            <CardDescription>
              Interactive decision-making tools for common DM challenges
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Get instant guidance on handling player conflicts, rules disputes, and other table situations.
            </p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center text-lg">
              <Zap className="h-5 w-5 mr-2 text-yellow-600" />
              Quick References
            </CardTitle>
            <CardDescription>
              Essential DM information at your fingertips
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Condition effects, spell save DCs, encounter difficulty guidelines, and more.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <h3 className="text-xl font-fantasy font-semibold">Guided Workflows</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {workflows.map((workflow) => {
            const Icon = workflow.icon;
            return (
              <Card key={workflow.id} className="cursor-pointer hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center text-lg">
                      <Icon className="h-5 w-5 mr-2 text-primary" />
                      {workflow.title}
                    </CardTitle>
                    <Badge variant={workflow.difficulty === "Beginner" ? "default" : "secondary"}>
                      {workflow.difficulty}
                    </Badge>
                  </div>
                  <CardDescription>{workflow.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Clock className="h-4 w-4 mr-1" />
                    <span>{workflow.duration}</span>
                  </div>
                  <div className="flex items-center text-sm text-muted-foreground">
                    <BookOpen className="h-4 w-4 mr-1" />
                    <span>{workflow.steps.length} steps</span>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button
                    className="w-full"
                    onClick={() => handleWorkflowStart(workflow.id)}
                  >
                    Start Workflow
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}