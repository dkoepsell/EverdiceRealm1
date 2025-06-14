import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { 
  BookOpen, 
  Sparkles, 
  Play as PlayIcon, 
  Users, 
  MapPin, 
  Scroll, 
  Package, 
  Swords, 
  Mail, 
  StickyNote, 
  Zap,
  Globe,
  Brain,
  Gift,
  Wand2,
  Star,
  Target,
  Crown,
  Eye,
  Save,
  ArrowDown,
  ChevronDown
} from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Loader2, AlertCircle } from "lucide-react";
import DMTrainingCenterTab from "@/components/dm-toolkit/DMTrainingCenterTab";
import LiveCampaignManagerTab from "@/components/dm-toolkit/LiveCampaignManagerTab";
import InvitationsTab from "@/components/dm-toolkit/InvitationsTab";
import NotesTabSimple from "@/components/dm-toolkit/NotesTabSimple";
import AIAssistedDMGuide from "@/components/dm-toolkit/AIAssistedDMGuide";

export default function DMToolkit() {
  const { toast } = useToast();
  const { user, isLoading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState("training");
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | null>(null);
  
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
    <div className="container mx-auto p-6 space-y-8">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold text-foreground">Dungeon Master Toolkit</h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Create and manage your campaigns with these powerful tools
        </p>
      </div>

      <div className="space-y-8">
        {/* Essential Tools */}
        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-foreground flex items-center">
            <Crown className="h-5 w-5 mr-2 text-primary" />
            Essential Tools
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card 
              className={`cursor-pointer transition-all duration-300 hover:shadow-lg hover:scale-105 transform border-2 ${
                activeTab === 'training' ? 'border-primary bg-primary/10 shadow-lg scale-105' : 'border-border hover:border-primary/50'
              }`}
              onClick={() => setActiveTab('training')}
            >
              <CardContent className="p-6 text-center">
                <BookOpen className="h-10 w-10 mx-auto mb-3 text-primary" />
                <h4 className="font-semibold text-lg mb-2">DM Training</h4>
                <p className="text-sm text-muted-foreground">Master essential DM skills and techniques</p>
              </CardContent>
            </Card>

            <Card 
              className={`cursor-pointer transition-all duration-300 hover:shadow-lg hover:scale-105 transform border-2 ${
                activeTab === 'campaign-builder' ? 'border-primary bg-primary/10 shadow-lg scale-105' : 'border-border hover:border-primary/50'
              }`}
              onClick={() => setActiveTab('campaign-builder')}
            >
              <CardContent className="p-6 text-center">
                <Sparkles className="h-10 w-10 mx-auto mb-3 text-primary" />
                <h4 className="font-semibold text-lg mb-2">Campaign Builder</h4>
                <p className="text-sm text-muted-foreground">Generate complete, ready-to-run campaigns</p>
              </CardContent>
            </Card>

            <Card 
              className={`cursor-pointer transition-all duration-300 hover:shadow-lg hover:scale-105 transform border-2 ${
                activeTab === 'live-manager' ? 'border-primary bg-primary/10 shadow-lg scale-105' : 'border-border hover:border-primary/50'
              }`}
              onClick={() => setActiveTab('live-manager')}
            >
              <CardContent className="p-6 text-center">
                <PlayIcon className="h-10 w-10 mx-auto mb-3 text-primary" />
                <h4 className="font-semibold text-lg mb-2">Live Manager</h4>
                <p className="text-sm text-muted-foreground">Run and manage active game sessions</p>
              </CardContent>
            </Card>

            <Card 
              className={`cursor-pointer transition-all duration-300 hover:shadow-lg hover:scale-105 transform border-2 ${
                activeTab === 'generators' ? 'border-primary bg-primary/10 shadow-lg scale-105' : 'border-border hover:border-primary/50'
              }`}
              onClick={() => setActiveTab('generators')}
            >
              <CardContent className="p-6 text-center">
                <Wand2 className="h-10 w-10 mx-auto mb-3 text-primary" />
                <h4 className="font-semibold text-lg mb-2">Generators</h4>
                <p className="text-sm text-muted-foreground">Quick content creation tools</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Content Creation */}
        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-foreground flex items-center">
            <Brain className="h-5 w-5 mr-2 text-primary" />
            Content Creation
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <Card 
              className={`cursor-pointer transition-all duration-300 hover:shadow-md hover:scale-105 transform ${
                activeTab === 'companions' ? 'border-primary bg-primary/10 scale-105' : 'border-border hover:border-primary/50'
              }`}
              onClick={() => setActiveTab('companions')}
            >
              <CardContent className="p-4 text-center">
                <Users className="h-8 w-8 mx-auto mb-2 text-primary" />
                <h5 className="font-medium">NPCs</h5>
              </CardContent>
            </Card>

            <Card 
              className={`cursor-pointer transition-all duration-300 hover:shadow-md hover:scale-105 transform ${
                activeTab === 'locations' ? 'border-primary bg-primary/10 scale-105' : 'border-border hover:border-primary/50'
              }`}
              onClick={() => setActiveTab('locations')}
            >
              <CardContent className="p-4 text-center">
                <MapPin className="h-8 w-8 mx-auto mb-2 text-primary" />
                <h5 className="font-medium">Locations</h5>
              </CardContent>
            </Card>

            <Card 
              className={`cursor-pointer transition-all duration-300 hover:shadow-md hover:scale-105 transform ${
                activeTab === 'quests' ? 'border-primary bg-primary/10 scale-105' : 'border-border hover:border-primary/50'
              }`}
              onClick={() => setActiveTab('quests')}
            >
              <CardContent className="p-4 text-center">
                <Scroll className="h-8 w-8 mx-auto mb-2 text-primary" />
                <h5 className="font-medium">Quests</h5>
              </CardContent>
            </Card>

            <Card 
              className={`cursor-pointer transition-all duration-300 hover:shadow-md hover:scale-105 transform ${
                activeTab === 'items' ? 'border-primary bg-primary/10 scale-105' : 'border-border hover:border-primary/50'
              }`}
              onClick={() => setActiveTab('items')}
            >
              <CardContent className="p-4 text-center">
                <Package className="h-8 w-8 mx-auto mb-2 text-primary" />
                <h5 className="font-medium">Items</h5>
              </CardContent>
            </Card>

            <Card 
              className={`cursor-pointer transition-all duration-300 hover:shadow-md hover:scale-105 transform ${
                activeTab === 'monsters' ? 'border-primary bg-primary/10 scale-105' : 'border-border hover:border-primary/50'
              }`}
              onClick={() => setActiveTab('monsters')}
            >
              <CardContent className="p-4 text-center">
                <Swords className="h-8 w-8 mx-auto mb-2 text-primary" />
                <h5 className="font-medium">Monsters</h5>
              </CardContent>
            </Card>

            <Card 
              className={`cursor-pointer transition-all duration-300 hover:shadow-md hover:scale-105 transform ${
                activeTab === 'deploy' ? 'border-primary bg-primary/10 scale-105' : 'border-border hover:border-primary/50'
              }`}
              onClick={() => setActiveTab('deploy')}
            >
              <CardContent className="p-4 text-center">
                <Globe className="h-8 w-8 mx-auto mb-2 text-primary" />
                <h5 className="font-medium">Deploy</h5>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Utilities */}
        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-foreground flex items-center">
            <Zap className="h-5 w-5 mr-2 text-primary" />
            Utilities
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card 
              className={`cursor-pointer transition-all duration-300 hover:shadow-md hover:scale-105 transform ${
                activeTab === 'invitations' ? 'border-primary bg-primary/10 scale-105' : 'border-border hover:border-primary/50'
              }`}
              onClick={() => setActiveTab('invitations')}
            >
              <CardContent className="p-4 text-center">
                <Mail className="h-8 w-8 mx-auto mb-2 text-primary" />
                <h5 className="font-medium">Invitations</h5>
              </CardContent>
            </Card>

            <Card 
              className={`cursor-pointer transition-all duration-300 hover:shadow-md hover:scale-105 transform ${
                activeTab === 'notes' ? 'border-primary bg-primary/10 scale-105' : 'border-border hover:border-primary/50'
              }`}
              onClick={() => setActiveTab('notes')}
            >
              <CardContent className="p-4 text-center">
                <StickyNote className="h-8 w-8 mx-auto mb-2 text-primary" />
                <h5 className="font-medium">Notes</h5>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Prominent Visual Connection and Content */}
      {activeTab && (
        <div className="mt-12">
          {/* Eye-catching bouncing arrow pointing down */}
          <div className="flex flex-col items-center mb-8">
            <div className="text-center mb-4">
              <div className="inline-flex items-center px-6 py-3 bg-primary/10 border border-primary/30 rounded-full">
                <div className="h-2 w-2 bg-primary rounded-full animate-pulse mr-3"></div>
                <span className="text-primary font-semibold">Selected Tool Loading Below</span>
              </div>
            </div>
            <div className="animate-bounce">
              <ChevronDown className="h-8 w-8 text-primary" />
            </div>
            <div className="h-12 w-px bg-gradient-to-b from-primary to-transparent opacity-50"></div>
          </div>

          {/* Large prominent content area */}
          <div className="animate-in slide-in-from-bottom-6 duration-700 ease-out">
            <Card className="border-2 border-primary/40 shadow-2xl bg-gradient-to-br from-background via-primary/5 to-background">
              <CardHeader className="border-b border-primary/20 bg-gradient-to-r from-primary/10 to-transparent">
                <CardTitle className="text-2xl font-bold text-primary flex items-center">
                  <div className="h-4 w-4 bg-primary rounded-full animate-pulse mr-3"></div>
                  {activeTab === 'training' && 'DM Training Center'}
                  {activeTab === 'campaign-builder' && 'AI Campaign Builder'}
                  {activeTab === 'live-manager' && 'Live Campaign Manager'}
                  {activeTab === 'companions' && 'NPC Management'}
                  {activeTab === 'locations' && 'Location Creation'}
                  {activeTab === 'quests' && 'Quest Management'}
                  {activeTab === 'items' && 'Magic Items'}
                  {activeTab === 'monsters' && 'Monster Creation'}
                  {activeTab === 'invitations' && 'Player Invitations'}
                  {activeTab === 'notes' && 'Campaign Notes'}
                  {activeTab === 'generators' && 'Content Generators'}
                  {activeTab === 'deploy' && 'Campaign Deployment'}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-8">
                <div className="animate-in fade-in-50 duration-500 delay-300">
                  <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="hidden">
                      <TabsTrigger value="training">Training</TabsTrigger>
                      <TabsTrigger value="campaign-builder">Campaign Builder</TabsTrigger>
                      <TabsTrigger value="live-manager">Live Manager</TabsTrigger>
                      <TabsTrigger value="companions">Companions</TabsTrigger>
                      <TabsTrigger value="locations">Locations</TabsTrigger>
                      <TabsTrigger value="quests">Quests</TabsTrigger>
                      <TabsTrigger value="items">Items</TabsTrigger>
                      <TabsTrigger value="monsters">Monsters</TabsTrigger>
                      <TabsTrigger value="invitations">Invitations</TabsTrigger>
                      <TabsTrigger value="notes">Notes</TabsTrigger>
                      <TabsTrigger value="generators">Generators</TabsTrigger>
                      <TabsTrigger value="deploy">Deploy</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="training">
                      <DMTrainingCenterTab />
                    </TabsContent>
                    
                    <TabsContent value="campaign-builder">
                      <CampaignBuilderContent />
                    </TabsContent>
                    
                    <TabsContent value="live-manager">
                      <LiveCampaignManagerTab 
                        selectedCampaignId={selectedCampaignId}
                        onCampaignSelect={setSelectedCampaignId}
                      />
                    </TabsContent>
                    
                    <TabsContent value="companions">
                      <AIAssistedDMGuide />
                    </TabsContent>
                    
                    <TabsContent value="locations">
                      <ContentPlaceholder 
                        icon={MapPin} 
                        title="Location Creation" 
                        description="Design detailed locations and immersive environments"
                      />
                    </TabsContent>
                    
                    <TabsContent value="quests">
                      <ContentPlaceholder 
                        icon={Scroll} 
                        title="Quest Management" 
                        description="Create and track engaging campaign quests and storylines"
                      />
                    </TabsContent>
                    
                    <TabsContent value="items">
                      <ContentPlaceholder 
                        icon={Package} 
                        title="Magic Items" 
                        description="Design unique magical items and treasures for your adventures"
                      />
                    </TabsContent>
                    
                    <TabsContent value="monsters">
                      <ContentPlaceholder 
                        icon={Swords} 
                        title="Monster Creation" 
                        description="Create custom monsters and challenging encounters"
                      />
                    </TabsContent>
                    
                    <TabsContent value="invitations">
                      <InvitationsTab />
                    </TabsContent>
                    
                    <TabsContent value="notes">
                      <NotesTabSimple />
                    </TabsContent>
                    
                    <TabsContent value="generators">
                      <ContentPlaceholder 
                        icon={Wand2} 
                        title="Content Generators" 
                        description="Generate names, encounters, and other content quickly with AI assistance"
                      />
                    </TabsContent>
                    
                    <TabsContent value="deploy">
                      <ContentPlaceholder 
                        icon={Globe} 
                        title="Campaign Deployment" 
                        description="Share and deploy your campaigns for players to access"
                      />
                    </TabsContent>
                  </Tabs>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

// Placeholder component for content sections
function ContentPlaceholder({ icon: Icon, title, description }: { 
  icon: React.ComponentType<any>, 
  title: string, 
  description: string 
}) {
  return (
    <div className="text-center py-16">
      <div className="inline-flex items-center justify-center w-20 h-20 bg-primary/10 rounded-full mb-6">
        <Icon className="h-10 w-10 text-primary" />
      </div>
      <h3 className="text-2xl font-bold mb-4">{title}</h3>
      <p className="text-lg text-muted-foreground max-w-2xl mx-auto">{description}</p>
      <div className="mt-8">
        <Button variant="outline" size="lg">
          Coming Soon
        </Button>
      </div>
    </div>
  );
}

// Campaign Builder specific content
function CampaignBuilderContent() {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [campaignParams, setCampaignParams] = useState({
    type: '',
    level: '',
    length: '',
    theme: ''
  });

  const generateCampaign = useMutation({
    mutationFn: async (params: typeof campaignParams) => {
      const response = await fetch('/api/generate-campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });
      if (!response.ok) throw new Error('Failed to generate campaign');
      return response.json();
    },
    onSuccess: () => {
      setIsGenerating(false);
      toast({
        title: "Campaign Generated!",
        description: "Your complete campaign package is ready.",
      });
    },
    onError: (error: Error) => {
      setIsGenerating(false);
      toast({
        title: "Generation Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleGenerate = () => {
    const { type, level, length, theme } = campaignParams;
    if (!type || !level || !length || !theme) {
      toast({
        title: "Missing Information",
        description: "Please fill in all campaign parameters.",
        variant: "destructive",
      });
      return;
    }
    setIsGenerating(true);
    generateCampaign.mutate(campaignParams);
  };

  return (
    <div className="space-y-8">
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center space-x-3 mb-4">
          <Sparkles className="h-8 w-8 text-primary" />
          <h2 className="text-3xl font-bold">AI Campaign Builder</h2>
        </div>
        <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
          Generate complete, interconnected campaigns with quests, NPCs, locations, encounters, and rewards. 
          Perfect for DMs who want to jump right into running an adventure.
        </p>
      </div>

      <Card className="border-2 border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Target className="h-5 w-5" />
            <span>Campaign Parameters</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Campaign Type</Label>
              <Select value={campaignParams.type} onValueChange={(value) => 
                setCampaignParams({...campaignParams, type: value})
              }>
                <SelectTrigger>
                  <SelectValue placeholder="Select campaign type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="adventure">Classic Adventure</SelectItem>
                  <SelectItem value="mystery">Mystery & Investigation</SelectItem>
                  <SelectItem value="political">Political Intrigue</SelectItem>
                  <SelectItem value="exploration">Exploration & Discovery</SelectItem>
                  <SelectItem value="war">War & Conflict</SelectItem>
                  <SelectItem value="horror">Horror & Supernatural</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Party Level Range</Label>
              <Select value={campaignParams.level} onValueChange={(value) => 
                setCampaignParams({...campaignParams, level: value})
              }>
                <SelectTrigger>
                  <SelectValue placeholder="Select level range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1-5">Levels 1-5 (Beginner)</SelectItem>
                  <SelectItem value="6-10">Levels 6-10 (Intermediate)</SelectItem>
                  <SelectItem value="11-15">Levels 11-15 (Advanced)</SelectItem>
                  <SelectItem value="16-20">Levels 16-20 (Epic)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Campaign Length</Label>
              <Select value={campaignParams.length} onValueChange={(value) => 
                setCampaignParams({...campaignParams, length: value})
              }>
                <SelectTrigger>
                  <SelectValue placeholder="Select duration" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="short">Short (4-6 sessions)</SelectItem>
                  <SelectItem value="medium">Medium (8-12 sessions)</SelectItem>
                  <SelectItem value="long">Long (15-20 sessions)</SelectItem>
                  <SelectItem value="epic">Epic (25+ sessions)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Theme & Setting</Label>
              <Select value={campaignParams.theme} onValueChange={(value) => 
                setCampaignParams({...campaignParams, theme: value})
              }>
                <SelectTrigger>
                  <SelectValue placeholder="Select theme" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high-fantasy">High Fantasy</SelectItem>
                  <SelectItem value="dark-fantasy">Dark Fantasy</SelectItem>
                  <SelectItem value="urban-fantasy">Urban Fantasy</SelectItem>
                  <SelectItem value="steampunk">Steampunk</SelectItem>
                  <SelectItem value="post-apocalyptic">Post-Apocalyptic</SelectItem>
                  <SelectItem value="seafaring">Seafaring Adventure</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-center pt-4">
            <Button 
              onClick={handleGenerate}
              disabled={isGenerating}
              size="lg"
              className="px-8"
            >
              {isGenerating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Generating Campaign...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate Complete Campaign
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}