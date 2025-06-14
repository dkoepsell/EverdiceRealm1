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
  Save
} from "lucide-react";
import { useMutation } from "@tanstack/react-query";

export default function DMToolkit() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("training");

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

      {/* Selected Tool Content with Enhanced Animation */}
      {activeTab && (
        <div className="mt-12 animate-in slide-in-from-bottom-8 duration-700 ease-out">
          {/* Visual Connection Indicator */}
          <div className="flex items-center space-x-4 mb-8 p-4 bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 rounded-xl">
            <div className="flex items-center space-x-2">
              <div className="h-2 w-2 bg-primary rounded-full animate-pulse"></div>
              <div className="h-1 w-8 bg-gradient-to-r from-primary to-primary/50 rounded-full"></div>
            </div>
            <div className="text-lg font-semibold text-primary">
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
            </div>
            <div className="flex-1 h-px bg-gradient-to-r from-primary/30 via-primary/10 to-transparent"></div>
          </div>
          
          {/* Content Area with Fade Animation */}
          <div className="animate-in fade-in-50 duration-500 delay-200">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
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
              
              <TabsContent value="training" className="space-y-4">
                <DMTrainingPlaceholder />
              </TabsContent>
              
              <TabsContent value="campaign-builder" className="space-y-4">
                <CampaignBuilderTab />
              </TabsContent>
              
              <TabsContent value="live-manager" className="space-y-4">
                <LiveManagerPlaceholder />
              </TabsContent>
              
              <TabsContent value="companions" className="space-y-4">
                <ContentPlaceholder 
                  icon={Users} 
                  title="NPC Management" 
                  description="Create and manage non-player characters for your campaigns"
                />
              </TabsContent>
              
              <TabsContent value="locations" className="space-y-4">
                <ContentPlaceholder 
                  icon={MapPin} 
                  title="Location Creation" 
                  description="Design detailed locations and environments"
                />
              </TabsContent>
              
              <TabsContent value="quests" className="space-y-4">
                <ContentPlaceholder 
                  icon={Scroll} 
                  title="Quest Management" 
                  description="Create and track campaign quests and storylines"
                />
              </TabsContent>
              
              <TabsContent value="items" className="space-y-4">
                <ContentPlaceholder 
                  icon={Package} 
                  title="Magic Items" 
                  description="Design unique magical items and treasures"
                />
              </TabsContent>
              
              <TabsContent value="monsters" className="space-y-4">
                <ContentPlaceholder 
                  icon={Swords} 
                  title="Monster Creation" 
                  description="Create custom monsters and encounters"
                />
              </TabsContent>
              
              <TabsContent value="invitations" className="space-y-4">
                <ContentPlaceholder 
                  icon={Mail} 
                  title="Player Invitations" 
                  description="Invite players to join your campaigns"
                />
              </TabsContent>
              
              <TabsContent value="notes" className="space-y-4">
                <ContentPlaceholder 
                  icon={StickyNote} 
                  title="Campaign Notes" 
                  description="Keep track of important campaign information"
                />
              </TabsContent>
              
              <TabsContent value="generators" className="space-y-4">
                <ContentPlaceholder 
                  icon={Wand2} 
                  title="Content Generators" 
                  description="Generate names, encounters, and other content quickly"
                />
              </TabsContent>
              
              <TabsContent value="deploy" className="space-y-4">
                <ContentPlaceholder 
                  icon={Globe} 
                  title="Campaign Deployment" 
                  description="Share and deploy your campaigns for players"
                />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      )}
    </div>
  );
}

// Placeholder Components
function ContentPlaceholder({ icon: Icon, title, description }: { icon: any, title: string, description: string }) {
  return (
    <div className="text-center py-12">
      <Icon className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground">{description}</p>
    </div>
  );
}

function DMTrainingPlaceholder() {
  return (
    <div className="text-center py-12">
      <BookOpen className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
      <h3 className="text-xl font-semibold mb-2">DM Training Center</h3>
      <p className="text-muted-foreground">Master the art of Dungeon Mastering with comprehensive training modules</p>
    </div>
  );
}

function LiveManagerPlaceholder() {
  return (
    <div className="text-center py-12">
      <PlayIcon className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
      <h3 className="text-xl font-semibold mb-2">Live Campaign Manager</h3>
      <p className="text-muted-foreground">Run and manage your active game sessions in real-time</p>
    </div>
  );
}

// Campaign Builder Component
function CampaignBuilderTab() {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedCampaign, setGeneratedCampaign] = useState<any>(null);
  const [campaignParams, setCampaignParams] = useState({
    type: '',
    level: '',
    length: '',
    theme: ''
  });

  const generateCampaign = useMutation({
    mutationFn: async (params: any) => {
      const response = await fetch('/api/generate-campaign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params)
      });
      if (!response.ok) {
        throw new Error('Failed to generate campaign');
      }
      return response.json();
    },
    onSuccess: (data) => {
      setGeneratedCampaign(data);
      setIsGenerating(false);
      toast({
        title: "Campaign Generated!",
        description: "Your complete campaign package is ready to review and save.",
      });
    },
    onError: (error: Error) => {
      setIsGenerating(false);
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate campaign. Please try again.",
        variant: "destructive",
      });
    }
  });

  const handleGenerate = () => {
    if (!campaignParams.type || !campaignParams.level || !campaignParams.length || !campaignParams.theme) {
      toast({
        title: "Missing Information",
        description: "Please fill in all campaign parameters before generating.",
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
        <div className="flex items-center justify-center space-x-3">
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
              <Label htmlFor="campaign-type">Campaign Type</Label>
              <Select value={campaignParams.type} onValueChange={(value) => setCampaignParams({...campaignParams, type: value})}>
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
              <Label htmlFor="party-level">Party Level Range</Label>
              <Select value={campaignParams.level} onValueChange={(value) => setCampaignParams({...campaignParams, level: value})}>
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
              <Label htmlFor="campaign-length">Campaign Length</Label>
              <Select value={campaignParams.length} onValueChange={(value) => setCampaignParams({...campaignParams, length: value})}>
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
              <Label htmlFor="campaign-theme">Theme & Setting</Label>
              <Select value={campaignParams.theme} onValueChange={(value) => setCampaignParams({...campaignParams, theme: value})}>
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

      {/* Campaign Preview */}
      {generatedCampaign && (
        <div className="animate-in slide-in-from-bottom-4 duration-500">
          <Card className="border-2 border-green-500/20 bg-green-50/50 dark:bg-green-950/20">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-green-700 dark:text-green-300">
                <Star className="h-5 w-5" />
                <span>{generatedCampaign.title}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-6">{generatedCampaign.description}</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                <div className="text-center p-4 bg-white/50 dark:bg-gray-800/50 rounded-lg">
                  <Scroll className="h-8 w-8 mx-auto mb-2 text-primary" />
                  <div className="font-semibold">{generatedCampaign.quests?.length || 0} Quests</div>
                  <div className="text-sm text-muted-foreground">Interconnected storylines</div>
                </div>
                <div className="text-center p-4 bg-white/50 dark:bg-gray-800/50 rounded-lg">
                  <Users className="h-8 w-8 mx-auto mb-2 text-primary" />
                  <div className="font-semibold">{generatedCampaign.npcs?.length || 0} NPCs</div>
                  <div className="text-sm text-muted-foreground">Memorable characters</div>
                </div>
                <div className="text-center p-4 bg-white/50 dark:bg-gray-800/50 rounded-lg">
                  <MapPin className="h-8 w-8 mx-auto mb-2 text-primary" />
                  <div className="font-semibold">{generatedCampaign.locations?.length || 0} Locations</div>
                  <div className="text-sm text-muted-foreground">Detailed environments</div>
                </div>
              </div>

              <div className="flex justify-center space-x-4">
                <Button variant="outline" size="sm">
                  <Eye className="h-4 w-4 mr-2" />
                  Preview Details
                </Button>
                <Button size="sm">
                  <Save className="h-4 w-4 mr-2" />
                  Save Campaign
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* What You'll Get Info */}
      <Card className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 border-2 border-blue-200/50 dark:border-blue-800/50">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Gift className="h-5 w-5 text-blue-600" />
            <span>What You'll Get</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="flex items-start space-x-3">
              <Scroll className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <div className="font-medium">Interconnected Quests</div>
                <p className="text-sm text-muted-foreground">Main story arc with side quests that enhance the narrative</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <Users className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <div className="font-medium">Memorable NPCs</div>
                <p className="text-sm text-muted-foreground">Fully developed characters with motivations and personalities</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <MapPin className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <div className="font-medium">Detailed Locations</div>
                <p className="text-sm text-muted-foreground">Rich environments with features and encounter possibilities</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <Swords className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <div className="font-medium">Balanced Encounters</div>
                <p className="text-sm text-muted-foreground">Combat, social, and exploration challenges</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <Package className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <div className="font-medium">Meaningful Rewards</div>
                <p className="text-sm text-muted-foreground">Magic items, treasure, and story rewards tied to quests</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <Brain className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <div className="font-medium">DM Guidance</div>
                <p className="text-sm text-muted-foreground">Tips and advice for running each element effectively</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}