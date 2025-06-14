import { useState } from "react";
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
  StickyNote
} from "lucide-react";

// Import our new tabs
import InvitationsTab from "@/components/dm-toolkit/InvitationsTab";
import NotesTabSimple from "@/components/dm-toolkit/NotesTabSimple";

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
    <div className="container px-4 py-6 md:py-8">
      <div className="space-y-2 mb-6 md:mb-8">
        <h1 className="text-2xl md:text-3xl font-fantasy font-bold">Dungeon Master Toolkit</h1>
        <p className="text-sm md:text-base text-muted-foreground">Create and manage your campaigns with these powerful tools</p>
      </div>
      
      <Tabs defaultValue="companions" value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid grid-cols-3 md:grid-cols-8 lg:grid-cols-9 w-full overflow-x-auto">
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
          <div className="text-center py-12">
            <BookOpen className="h-12 w-12 mx-auto mb-2 text-muted-foreground" />
            <p className="text-muted-foreground">Generate content tools will be available soon</p>
          </div>
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
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-fantasy font-semibold">Locations & Maps</h2>
          <p className="text-muted-foreground">Create and manage locations for your adventures</p>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button disabled>
                <Plus className="h-4 w-4 mr-2" /> Create Location
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Coming Soon! This feature will be available in a future update.</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      
      <Card className="mb-6 p-4 border-amber-500/50 bg-amber-100 dark:bg-amber-950/20">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-amber-500" />
          <p className="text-amber-700 dark:text-amber-400 font-medium">
            Coming Soon! The Locations feature is under development and will be available in a future update.
          </p>
        </div>
      </Card>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="font-fantasy">Elemental Forge</CardTitle>
            <CardDescription>Underground magical forge</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="aspect-video bg-muted/50 rounded-md flex items-center justify-center mb-3">
              <MapPin className="h-12 w-12 text-muted-foreground" />
            </div>
            <p className="text-sm">An ancient forge powered by elemental fire, where legendary weapons were once crafted by the dwarves of old.</p>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button variant="outline" size="sm">View Details</Button>
            <Button size="sm">Edit Location</Button>
          </CardFooter>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="font-fantasy">Whispering Woods</CardTitle>
            <CardDescription>Enchanted forest</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="aspect-video bg-muted/50 rounded-md flex items-center justify-center mb-3">
              <Trees className="h-12 w-12 text-muted-foreground" />
            </div>
            <p className="text-sm">A forest where the trees themselves whisper ancient secrets, home to fey creatures and magical beasts.</p>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button variant="outline" size="sm">View Details</Button>
            <Button size="sm">Edit Location</Button>
          </CardFooter>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="font-fantasy">Stormwatch Keep</CardTitle>
            <CardDescription>Cliffside fortress</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="aspect-video bg-muted/50 rounded-md flex items-center justify-center mb-3">
              <Castle className="h-12 w-12 text-muted-foreground" />
            </div>
            <p className="text-sm">A weathered fortress built upon sheer cliffs, offering magnificent but dangerous views of the raging sea below.</p>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button variant="outline" size="sm">View Details</Button>
            <Button size="sm">Edit Location</Button>
          </CardFooter>
        </Card>
        
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
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-fantasy font-semibold">Quests & Adventures</h2>
          <p className="text-muted-foreground">Design quests and adventures for your campaigns</p>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button disabled>
                <Plus className="h-4 w-4 mr-2" /> Create Quest
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Coming Soon! This feature will be available in a future update.</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      
      <Card className="mb-6 p-4 border-amber-500/50 bg-amber-100 dark:bg-amber-950/20">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-amber-500" />
          <p className="text-amber-700 dark:text-amber-400 font-medium">
            Coming Soon! The Quests feature is under development and will be available in a future update.
          </p>
        </div>
      </Card>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="flex justify-between">
              <CardTitle className="font-fantasy">The Lost Artifact</CardTitle>
              <Badge>Level 3-5</Badge>
            </div>
            <CardDescription>Investigation & Retrieval</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm mb-3">A powerful magical artifact has been stolen from the city's arcane university. The characters must track it down before it falls into the wrong hands.</p>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Difficulty:</span>
                <span>Moderate</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Suggested Party Size:</span>
                <span>3-5 Characters</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Estimated Duration:</span>
                <span>2-3 Sessions</span>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button variant="outline" size="sm">View Details</Button>
            <Button size="sm">Edit Quest</Button>
          </CardFooter>
        </Card>
        
        <Card>
          <CardHeader>
            <div className="flex justify-between">
              <CardTitle className="font-fantasy">Curse of the Ancient Tomb</CardTitle>
              <Badge>Level 5-7</Badge>
            </div>
            <CardDescription>Dungeon Delve & Curse Breaking</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm mb-3">A nobleman's son has fallen ill with a mysterious curse after exploring ancient ruins. The characters must enter the tomb to find the source of the curse and break it.</p>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Difficulty:</span>
                <span>Challenging</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Suggested Party Size:</span>
                <span>4-6 Characters</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Estimated Duration:</span>
                <span>3-4 Sessions</span>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button variant="outline" size="sm">View Details</Button>
            <Button size="sm">Edit Quest</Button>
          </CardFooter>
        </Card>
        
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
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-fantasy font-semibold">Magic Items</h2>
          <p className="text-muted-foreground">Create and manage magical items for your campaigns</p>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button disabled>
                <Plus className="h-4 w-4 mr-2" /> Create Magic Item
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Coming Soon! This feature will be available in a future update.</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      
      <Card className="mb-6 p-4 border-amber-500/50 bg-amber-100 dark:bg-amber-950/20">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-amber-500" />
          <p className="text-amber-700 dark:text-amber-400 font-medium">
            Coming Soon! The Magic Items feature is under development and will be available in a future update.
          </p>
        </div>
      </Card>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex justify-between">
              <CardTitle className="font-fantasy">Frostbrand Dagger</CardTitle>
              <Badge variant="outline">Rare</Badge>
            </div>
            <CardDescription>Weapon (dagger), requires attunement</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center mb-3">
              <div className="w-20 h-20 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                <Sparkles className="h-10 w-10 text-blue-500" />
              </div>
            </div>
            <p className="text-sm mb-3">A dagger with a blade made of enchanted ice that never melts. It deals an additional 1d6 cold damage and can create a small patch of ice on any surface once per day.</p>
            <Separator className="my-2" />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Damage: 1d4 + 1d6 cold</span>
              <span>Weight: 1 lb</span>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button variant="outline" size="sm">View Details</Button>
            <Button size="sm">Edit Item</Button>
          </CardFooter>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <div className="flex justify-between">
              <CardTitle className="font-fantasy">Cloak of Shadows</CardTitle>
              <Badge variant="outline">Uncommon</Badge>
            </div>
            <CardDescription>Wondrous item, requires attunement</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center mb-3">
              <div className="w-20 h-20 rounded-full bg-violet-100 dark:bg-violet-900 flex items-center justify-center">
                <Circle className="h-10 w-10 text-violet-500 fill-current" />
              </div>
            </div>
            <p className="text-sm mb-3">This dark cloak seems to absorb light around it. While wearing it, you have advantage on Dexterity (Stealth) checks made to hide in dim light or darkness.</p>
            <Separator className="my-2" />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Requires attunement</span>
              <span>Weight: 1 lb</span>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button variant="outline" size="sm">View Details</Button>
            <Button size="sm">Edit Item</Button>
          </CardFooter>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <div className="flex justify-between">
              <CardTitle className="font-fantasy">Ring of Mind Shielding</CardTitle>
              <Badge variant="outline">Uncommon</Badge>
            </div>
            <CardDescription>Ring, requires attunement</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center mb-3">
              <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                <Shield className="h-10 w-10 text-green-500" />
              </div>
            </div>
            <p className="text-sm mb-3">While wearing this ring, you are immune to magic that allows other creatures to read your thoughts, determine if you are lying, or know your alignment.</p>
            <Separator className="my-2" />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Requires attunement</span>
              <span>Weight: —</span>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button variant="outline" size="sm">View Details</Button>
            <Button size="sm">Edit Item</Button>
          </CardFooter>
        </Card>
        
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
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-fantasy font-semibold">Monster Creation</h2>
          <p className="text-muted-foreground">Design unique monsters and creatures for your campaigns</p>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button disabled>
                <Plus className="h-4 w-4 mr-2" /> Create Monster
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Coming Soon! This feature will be available in a future update.</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      
      <Card className="mb-6 p-4 border-amber-500/50 bg-amber-100 dark:bg-amber-950/20">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-amber-500" />
          <p className="text-amber-700 dark:text-amber-400 font-medium">
            Coming Soon! The Monster Creation feature is under development and will be available in a future update.
          </p>
        </div>
      </Card>
      
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex justify-between">
                <CardTitle className="font-fantasy">Shadow Drake</CardTitle>
                <Badge>CR 5</Badge>
              </div>
              <CardDescription>Medium dragon, neutral evil</CardDescription>
            </CardHeader>
            <CardContent className="pb-0">
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <div>
                    <span className="font-medium">Armor Class:</span> 16 (natural armor)
                  </div>
                  <div>
                    <span className="font-medium">Hit Points:</span> 110 (13d8 + 52)
                  </div>
                </div>
                
                <div className="flex justify-between text-sm">
                  <div>
                    <span className="font-medium">Speed:</span> 30 ft., fly 60 ft.
                  </div>
                  <div>
                    <span className="font-medium">Size:</span> Medium
                  </div>
                </div>
                
                <div className="grid grid-cols-6 gap-2 text-center text-sm mt-2">
                  <div className="space-y-1">
                    <div className="font-medium">STR</div>
                    <div className="bg-muted rounded-md py-1">16 (+3)</div>
                  </div>
                  <div className="space-y-1">
                    <div className="font-medium">DEX</div>
                    <div className="bg-muted rounded-md py-1">18 (+4)</div>
                  </div>
                  <div className="space-y-1">
                    <div className="font-medium">CON</div>
                    <div className="bg-muted rounded-md py-1">18 (+4)</div>
                  </div>
                  <div className="space-y-1">
                    <div className="font-medium">INT</div>
                    <div className="bg-muted rounded-md py-1">12 (+1)</div>
                  </div>
                  <div className="space-y-1">
                    <div className="font-medium">WIS</div>
                    <div className="bg-muted rounded-md py-1">14 (+2)</div>
                  </div>
                  <div className="space-y-1">
                    <div className="font-medium">CHA</div>
                    <div className="bg-muted rounded-md py-1">16 (+3)</div>
                  </div>
                </div>
                
                <div className="space-y-1">
                  <div className="font-medium text-sm">Special Abilities</div>
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium">Shadow Stealth.</span> While in dim light or darkness, the drake can take the Hide action as a bonus action.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium">Innate Spellcasting.</span> The drake can cast darkness 3/day, requiring no material components.
                  </p>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between pt-3">
              <Button variant="outline" size="sm">View Details</Button>
              <Button size="sm">Edit Monster</Button>
            </CardFooter>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <div className="flex justify-between">
                <CardTitle className="font-fantasy">Forest Guardian</CardTitle>
                <Badge>CR 3</Badge>
              </div>
              <CardDescription>Large fey, neutral good</CardDescription>
            </CardHeader>
            <CardContent className="pb-0">
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <div>
                    <span className="font-medium">Armor Class:</span> 14 (natural armor)
                  </div>
                  <div>
                    <span className="font-medium">Hit Points:</span> 76 (9d10 + 27)
                  </div>
                </div>
                
                <div className="flex justify-between text-sm">
                  <div>
                    <span className="font-medium">Speed:</span> 40 ft.
                  </div>
                  <div>
                    <span className="font-medium">Size:</span> Large
                  </div>
                </div>
                
                <div className="grid grid-cols-6 gap-2 text-center text-sm mt-2">
                  <div className="space-y-1">
                    <div className="font-medium">STR</div>
                    <div className="bg-muted rounded-md py-1">18 (+4)</div>
                  </div>
                  <div className="space-y-1">
                    <div className="font-medium">DEX</div>
                    <div className="bg-muted rounded-md py-1">14 (+2)</div>
                  </div>
                  <div className="space-y-1">
                    <div className="font-medium">CON</div>
                    <div className="bg-muted rounded-md py-1">16 (+3)</div>
                  </div>
                  <div className="space-y-1">
                    <div className="font-medium">INT</div>
                    <div className="bg-muted rounded-md py-1">10 (+0)</div>
                  </div>
                  <div className="space-y-1">
                    <div className="font-medium">WIS</div>
                    <div className="bg-muted rounded-md py-1">16 (+3)</div>
                  </div>
                  <div className="space-y-1">
                    <div className="font-medium">CHA</div>
                    <div className="bg-muted rounded-md py-1">13 (+1)</div>
                  </div>
                </div>
                
                <div className="space-y-1">
                  <div className="font-medium text-sm">Special Abilities</div>
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium">Magic Resistance.</span> The guardian has advantage on saving throws against spells and other magical effects.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium">Forest Blend.</span> The guardian has advantage on Dexterity (Stealth) checks made to hide in forest terrain.
                  </p>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between pt-3">
              <Button variant="outline" size="sm">View Details</Button>
              <Button size="sm">Edit Monster</Button>
            </CardFooter>
          </Card>
          
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