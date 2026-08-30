import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Campaign, insertCampaignSchema, WorldRegion, WorldLocation } from "@shared/schema";
import { queryClient, apiRequest, getQueryFn } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CampaignPanel from "@/components/campaign/CampaignPanel";
import { AlertCircle, Book, MapPin, Plus, Scroll, Wand2, Star, Play, Sparkles, ArrowRight, Lightbulb, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { motion } from "framer-motion";
import { OnboardingHint, OnboardingPulse, useOnboardingHint } from "@/components/onboarding/OnboardingHint";
import { useAnalytics } from "@/hooks/use-analytics";

// Extended schema with validation rules
const createCampaignSchema = insertCampaignSchema.extend({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  difficulty: z.string().min(1, "Please select a difficulty"),
  narrativeStyle: z.string().min(1, "Please select a narrative style"),
  campaignLength: z.string().min(1, "Please select a campaign length"),
});

// For AI campaign generation request
interface GenerateCampaignRequest {
  theme?: string;
  difficulty?: string;
  narrativeStyle?: string;
  numberOfSessions?: number;
  mainHook?: string;
}

type FormValues = z.infer<typeof createCampaignSchema>;

const difficulties = [
  "Easy - Beginner Friendly",
  "Normal - Balanced Challenge",
  "Hard - Deadly Encounters"
];

// Campaign length determines the number of chapters
const campaignLengths = [
  { value: "quick", label: "Quick Adventure", chapters: "3 chapters", time: "~30 min", description: "A short, focused adventure perfect for one sitting" },
  { value: "standard", label: "Standard Quest", chapters: "5-6 chapters", time: "~1-2 hours", description: "A balanced story with room for exploration" },
  { value: "epic", label: "Epic Saga", chapters: "8-10 chapters", time: "~3-4 hours", description: "A sprawling adventure with multiple story arcs" },
  { value: "legendary", label: "Legendary Campaign", chapters: "12-15 chapters", time: "~6+ hours", description: "A sweeping multi-session saga across many sessions" },
];

const narrativeStyles = [
  "Descriptive",
  "Dramatic",
  "Humorous",
  "Dark & Gritty",
  "Heroic Fantasy",
  "Mystery"
];

export default function Campaigns() {
  const { user } = useAuth();
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  // Controlled so the empty-state CTA can switch tabs. It used to fake a click
  // with dispatchEvent(new Event('click')), which is non-bubbling and not a
  // MouseEvent, so React's delegated listener never fired and the button did
  // nothing at all.
  const [activeTab, setActiveTab] = useState("list");
  const [useAIGeneration, setUseAIGeneration] = useState(false);
  const [generatingCampaign, setGeneratingCampaign] = useState(false);
  const [campaignTheme, setCampaignTheme] = useState("");
  
  // Active campaign from localStorage
  const [activeCampaignId, setActiveCampaignId] = useState<number | null>(() => {
    const saved = localStorage.getItem('activeCampaignId');
    return saved ? parseInt(saved) : null;
  });
  
  const setAsActiveAdventure = (campaignId: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setActiveCampaignId(campaignId);
    localStorage.setItem('activeCampaignId', campaignId.toString());
    toast({
      title: "Active Adventure Set",
      description: "This campaign is now your active adventure on the Dashboard.",
    });
  };
  
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { trackPageView, trackCampaignAction, trackFeatureUse } = useAnalytics();

  useEffect(() => {
    trackPageView('campaigns');
  }, [trackPageView]);
  
  const { data: campaigns, isLoading } = useQuery<Campaign[]>({
    queryKey: ['/api/campaigns'],
    queryFn: getQueryFn({ on401: "throw" })
  });

  // Deep link: /campaigns?open=<id> lands straight in that campaign. The party
  // activity notice on the dashboard points here, and a notice you have to go
  // hunting through a card grid to act on is not much of a notice.
  const [autoOpenHandled, setAutoOpenHandled] = useState(false);
  useEffect(() => {
    if (autoOpenHandled || !campaigns?.length) return;
    const requested = parseInt(new URLSearchParams(window.location.search).get('open') || '');
    if (!Number.isFinite(requested)) {
      setAutoOpenHandled(true);
      return;
    }
    const match = campaigns.find(c => c.id === requested);
    if (match) setSelectedCampaign(match);
    setAutoOpenHandled(true);
  }, [campaigns, autoOpenHandled]);

  // selectedCampaign is the snapshot captured when the card was clicked, so fields that
  // change during play — currentSession above all — stay frozen at their page-load values.
  // Re-read the row from the list query (which the play panel invalidates on a chapter
  // advance) so the panel renders live campaign state instead of a stale copy.
  const liveCampaign = useMemo(
    () => (selectedCampaign
      ? campaigns?.find((c) => c.id === selectedCampaign.id) ?? selectedCampaign
      : null),
    [campaigns, selectedCampaign]
  );

  const { data: characters } = useQuery({
    queryKey: ['/api/characters'],
    queryFn: getQueryFn({ on401: "throw" })
  });

  // Fetch world regions and locations for linking campaigns to the world map
  const { data: worldRegions = [] } = useQuery<WorldRegion[]>({
    queryKey: ['/api/world/regions'],
  });

  const { data: worldLocations = [] } = useQuery<WorldLocation[]>({
    queryKey: ['/api/world/locations'],
  });

  const [selectedWorldRegion, setSelectedWorldRegion] = useState<number | null>(null);

  // Filter locations by selected region
  const filteredWorldLocations = selectedWorldRegion 
    ? worldLocations.filter(loc => loc.regionId === selectedWorldRegion)
    : worldLocations;

  const form = useForm<FormValues>({
    resolver: zodResolver(createCampaignSchema),
    defaultValues: {
      userId: 1, // overwritten by server
      title: "",
      description: "",
      mainHook: "",
      difficulty: "",
      narrativeStyle: "",
      campaignLength: "standard",
      currentSession: 1,
      worldRegionId: null,
      worldLocationId: null,
      createdAt: new Date().toISOString(),
    },
  });
  
  const generateAICampaign = async () => {
    try {
      setGeneratingCampaign(true);
      
      // Make sure we have the required difficulty and narrative style
      const difficulty = form.getValues().difficulty;
      const narrativeStyle = form.getValues().narrativeStyle;
      
      // If difficulty or narrative style aren't selected, set some defaults
      const campaignDifficulty = difficulty || "Normal";
      const campaignNarrativeStyle = narrativeStyle || "Descriptive";
      
      // If they're not set, update the form
      if (!difficulty) {
        form.setValue("difficulty", campaignDifficulty);
      }
      
      if (!narrativeStyle) {
        form.setValue("narrativeStyle", campaignNarrativeStyle);
      }
      
      const mainHook = form.getValues().mainHook;
      const generateRequest: GenerateCampaignRequest = {
        theme: campaignTheme || undefined,
        difficulty: campaignDifficulty,
        narrativeStyle: campaignNarrativeStyle,
        numberOfSessions: 5,
        mainHook: mainHook || undefined
      };
      
      console.log("Sending request to generate campaign:", generateRequest);
      
      const response = await apiRequest("POST", "/api/campaigns/generate", generateRequest);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to generate campaign");
      }
      
      const generatedCampaign = await response.json();
      console.log("Generated campaign:", generatedCampaign);
      
      // Update the form with the generated campaign details
      form.setValue("title", generatedCampaign.title);
      form.setValue("description", generatedCampaign.description);
      form.setValue("difficulty", generatedCampaign.difficulty);
      form.setValue("narrativeStyle", generatedCampaign.narrativeStyle);
      
      toast({
        title: "Campaign Generated",
        description: "AI has created a new campaign concept! Review and submit to create it.",
      });
    } catch (error) {
      console.error("Error generating campaign:", error);
      toast({
        title: "Failed to Generate Campaign",
        description: error instanceof Error ? error.message : "An error occurred while generating the campaign. Please try again.",
        variant: "destructive",
      });
    } finally {
      setGeneratingCampaign(false);
    }
  };

  const createCampaign = useMutation({
    mutationFn: async (data: FormValues) => {
      const response = await apiRequest("POST", "/api/campaigns", data);
      return response.json();
    },
    onSuccess: (campaign) => {
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns'] });
      form.reset();
      setUseAIGeneration(false);
      setCampaignTheme("");

      // Take the player into the adventure. This used to stop at the toast and
      // form.reset(), which read as "nothing happened" — players responded by
      // hitting Create again, several times (one made 8 identical campaigns in
      // 42 minutes), and none of those campaigns ever saw a turn.
      if (campaign?.id) {
        // Campaign creation emitted no event, so the funnel showed 0 campaigns started
        // against 10 rows in the campaigns table and the real drop-off was only visible
        // by joining raw tables.
        trackCampaignAction("campaign_start", campaign.id, {
          aiGenerated: useAIGeneration,
          campaignLength: campaign.campaignLength,
        });

        // Set the active adventure directly rather than via
        // setAsActiveAdventure(), which raises its own toast.
        setActiveCampaignId(campaign.id);
        localStorage.setItem('activeCampaignId', campaign.id.toString());
        toast({
          title: "Campaign Created",
          description: "Your adventure is ready — opening it now.",
        });
        navigate("/dashboard");
      } else {
        toast({
          title: "Campaign Created",
          description: "Your campaign has been successfully created.",
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create campaign. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteCampaign = useMutation({
    mutationFn: async (campaignId: number) => {
      const response = await apiRequest("DELETE", `/api/campaigns/${campaignId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns/archived'] });
      setSelectedCampaign(null);
      toast({
        title: "Adventure deleted",
        description: "The adventure and everything in it has been permanently removed.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Couldn't delete adventure",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Hero Section - Modern style matching landing page */}
      <div className="container mx-auto px-4 py-8">
        <motion.section 
          className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary/10 to-amber-500/10 border border-primary/20 p-8 md:p-12 mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl -mr-16 -mt-16" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-primary/5 rounded-full blur-3xl -ml-12 -mb-12" />
          
          <div className="relative z-10 max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-4">
              <Book className="h-4 w-4" />
              Your Adventures
            </div>
            
            <h1 className="text-3xl md:text-4xl font-bold mb-4 bg-gradient-to-r from-amber-400 via-orange-400 to-red-400 bg-clip-text text-transparent">
              Campaign Management
            </h1>
            <p className="text-muted-foreground text-lg">
              Create, join, and manage your epic quests. Every adventure starts here.
            </p>
          </div>
        </motion.section>
      </div>
      
      <div className="container mx-auto px-4 pb-8">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="list" className="flex items-center gap-2">
            <Book size={16} />
            My Campaigns
          </TabsTrigger>
          <OnboardingHint
            hintId="campaign_create"
            title="Create Your First Adventure"
            description="Click here to start a new campaign. You can let AI generate everything for you, or customize every detail yourself."
            tip="Try the AI generator for a quick start - just pick a theme and it does the rest!"
            position="bottom"
            pulse={true}
          >
            <TabsTrigger value="create" className="flex items-center gap-2">
              <Plus size={16} />
              Create New
            </TabsTrigger>
          </OnboardingHint>
        </TabsList>
        
        <TabsContent value="list">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[1, 2].map((i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader>
                    <div className="h-6 bg-gray-300 rounded w-3/4"></div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="h-4 bg-gray-300 rounded w-1/2"></div>
                      <div className="h-4 bg-gray-300 rounded w-2/3"></div>
                      <div className="h-4 bg-gray-300 rounded w-3/4"></div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : campaigns && campaigns.length > 0 ? (
            <div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-6">
                {campaigns.map((campaign, index) => {
                  const isActive = activeCampaignId === campaign.id;
                  return (
                    <motion.div
                      key={campaign.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <Card 
                        className={`cursor-pointer hover:shadow-xl hover:border-primary/40 transition-all duration-300 overflow-hidden h-full bg-card/50 backdrop-blur ${isActive ? 'ring-2 ring-amber-500 ring-offset-2 ring-offset-background' : ''}`}
                        onClick={() => setSelectedCampaign(campaign)}
                      >
                        {(campaign as any).coverImageUrl && (
                          <div className="w-full h-32 overflow-hidden">
                            <img
                              src={(campaign as any).coverImageUrl}
                              alt={campaign.title}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          </div>
                        )}
                        <CardHeader className="pb-3 bg-gradient-to-r from-primary to-primary/80">
                          <div className="flex justify-between items-start">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                {isActive && <Star className="h-4 w-4 text-amber-400 fill-amber-400 flex-shrink-0" />}
                                <CardTitle className="text-white text-lg truncate">{campaign.title}</CardTitle>
                              </div>
                              {isActive && (
                                <Badge className="bg-amber-500/90 text-white text-xs">
                                  <Play className="h-3 w-3 mr-1" /> Active
                                </Badge>
                              )}
                            </div>
                            <div className="flex-shrink-0 bg-white/20 text-white text-xs px-2.5 py-1 rounded-full font-medium">
                              Chapter {campaign.currentSession}/{campaign.totalChapters || '?'}
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-4 flex flex-col h-[calc(100%-80px)]">
                          <p className="text-muted-foreground mb-4 line-clamp-2 flex-grow">{campaign.description}</p>

                          {(campaign as any).cliffhangerHook && (
                            <div className="mb-3 px-3 py-2 rounded-md bg-amber-950/40 border border-amber-800/30">
                              <p className="text-xs text-amber-400/70 uppercase tracking-wider mb-1 font-medium">When we last left your party...</p>
                              <p className="text-sm text-amber-200/90 italic leading-relaxed line-clamp-3">{(campaign as any).cliffhangerHook}</p>
                            </div>
                          )}

                          <div className="flex flex-wrap gap-1.5 mb-4">
                            <Badge variant="secondary" className="text-xs">
                              {campaign.campaignLength === 'quick' ? 'Quick' : campaign.campaignLength === 'epic' ? 'Epic' : campaign.campaignLength === 'legendary' ? 'Legendary' : 'Standard'}
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                              {campaign.totalChapters || 5} chapters
                            </Badge>
                            {campaign.narrativeStyle && (
                              <Badge variant="outline" className="text-xs">
                                {campaign.narrativeStyle}
                              </Badge>
                            )}
                          </div>
                          
                          <div className="flex gap-2">
                            {!isActive && !campaign.isArchived && !campaign.isCompleted && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex-1 border-primary/30 hover:bg-primary/10 hover:border-primary/50 transition-colors"
                                onClick={(e) => setAsActiveAdventure(campaign.id, e)}
                                data-testid={`button-set-active-campaign-${campaign.id}`}
                              >
                                <Star className="h-4 w-4 mr-2" />
                                Set as Active
                              </Button>
                            )}

                            {/* Only the creator can destroy an adventure; players who
                                merely joined it see no delete affordance. */}
                            {user?.id === campaign.userId && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className={`${isActive || campaign.isArchived || campaign.isCompleted ? 'w-full' : ''} border-red-500/30 text-red-500 hover:bg-red-500/10 hover:border-red-500/50 hover:text-red-500 transition-colors`}
                                  onClick={(e) => e.stopPropagation()}
                                  data-testid={`button-delete-campaign-${campaign.id}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                  {(isActive || campaign.isArchived || campaign.isCompleted) && (
                                    <span className="ml-2">Delete</span>
                                  )}
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete "{campaign.title}"?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This cannot be undone. The adventure and all of its chapters,
                                    quests, NPCs and maps will be permanently deleted.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteCampaign.mutate(campaign.id)}
                                    disabled={deleteCampaign.isPending}
                                    className="bg-red-500 hover:bg-red-600"
                                  >
                                    {deleteCampaign.isPending ? "Deleting..." : "Delete permanently"}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
              
              {liveCampaign && (
                <div className="mt-4">
                  <div className="flex justify-end mb-3">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setSelectedCampaign(null)}
                      className="text-sm"
                    >
                      Back to Campaign List
                    </Button>
                  </div>
                  <div className="min-h-[80vh]">
                    <CampaignPanel campaign={liveCampaign} />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <motion.div 
              className="text-center py-16 px-8 rounded-2xl bg-gradient-to-br from-primary/5 to-amber-500/5 border border-primary/10"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
            >
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
                <Book className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-2xl font-bold mb-3 bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
                No Adventures Yet
              </h3>
              <p className="text-muted-foreground mb-8 max-w-md mx-auto">
                Your epic journey awaits! Create your first campaign and start telling stories.
              </p>
              <Button 
                size="lg"
                className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-lg shadow-orange-500/25"
                onClick={() => setActiveTab("create")}
              >
                <Sparkles className="mr-2 h-5 w-5" />
                Create Your First Campaign
              </Button>
            </motion.div>
          )}
        </TabsContent>
        
        <TabsContent value="create">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
          <Card className="border-primary/20 bg-card/50 backdrop-blur overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-primary/5 to-amber-500/5 border-b border-primary/10">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Wand2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-xl">Create New Campaign</CardTitle>
                  <CardDescription>
                    Start a new adventure with built-in story continuity
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <div className="mb-6 pb-4 border-b border-gray-200">
                  <div className="flex items-center space-x-2 mb-4">
                    <FormLabel className="text-lg font-semibold !m-0">Quick Campaign Setup</FormLabel>
                    <OnboardingHint
                      hintId="campaign_ai_generate"
                      title="AI Campaign Generator"
                      description="Toggle this on to let AI create your entire campaign! Just pick a theme like 'dragon hunt' or 'mystery in the city' and we'll generate the story, NPCs, and encounters."
                      tip="Perfect for new players - get playing in seconds!"
                      position="right"
                      pulse={true}
                    >
                      <Switch
                        checked={useAIGeneration}
                        onCheckedChange={setUseAIGeneration}
                        aria-label="Use AI to generate campaign"
                      />
                    </OnboardingHint>
                  </div>
                  
                  {useAIGeneration && (
                    <div className="bg-secondary-light p-4 rounded-lg mb-4 space-y-4">
                      <div className="flex items-center space-x-2">
                        <Wand2 className="h-5 w-5 text-primary-light" />
                        <p className="text-sm text-gray-700">
                          Let AI create a complete campaign concept for you. Provide an optional theme below.
                        </p>
                      </div>
                      
                      <div className="space-y-2">
                        <label htmlFor="campaignTheme" className="text-sm font-medium">
                          Campaign Theme (Optional)
                        </label>
                        <Input
                          id="campaignTheme"
                          placeholder="e.g., Dragon hunt, Ancient ruins, Undead threat"
                          value={campaignTheme}
                          onChange={(e) => setCampaignTheme(e.target.value)}
                        />
                        <p className="text-xs text-gray-500">
                          First select difficulty and narrative style below, then click the 'Generate Campaign' button
                        </p>
                      </div>
                      
                      <Button 
                        type="button"
                        variant="outline"
                        className="w-full border-primary-light text-primary-light hover:bg-primary-light hover:text-white"
                        onClick={generateAICampaign}
                        disabled={generatingCampaign}
                      >
                        {generatingCampaign ? (
                          <>
                            <span className="animate-spin mr-2">⟳</span>
                            Generating Campaign...
                          </>
                        ) : (
                          <>
                            <Wand2 className="h-4 w-4 mr-2" />
                            Generate Campaign
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
                
                <form onSubmit={form.handleSubmit((data) => createCampaign.mutate(data))} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Campaign Title</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter a memorable title" {...field} />
                        </FormControl>
                        <FormDescription>
                          This will be the name of your adventure
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Describe your campaign setting and premise" 
                            className="min-h-[100px]"
                            {...field} 
                          />
                        </FormControl>
                        <FormDescription>
                          This will help the AI understand the type of adventure you want
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="mainHook"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Main Hook <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                        <FormControl>
                          <Input 
                            placeholder='e.g. "A cursed artifact is corrupting the forest" or "The king has been replaced by a shapeshifter"' 
                            {...field} 
                            value={field.value || ''}
                          />
                        </FormControl>
                        <FormDescription>
                          The central mystery, conflict, or premise that drives your campaign. The AI will weave the entire story around this hook.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="difficulty"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Difficulty</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select difficulty" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {difficulties.map(difficulty => (
                                <SelectItem key={difficulty} value={difficulty}>{difficulty}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="narrativeStyle"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Narrative Style</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select style" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {narrativeStyles.map(style => (
                                <SelectItem key={style} value={style}>{style}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  {/* Campaign Length - determines number of chapters */}
                  <FormField
                    control={form.control}
                    name="campaignLength"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Campaign Length</FormLabel>
                        <FormDescription className="text-xs mb-2">
                          How long do you want your adventure to be?
                        </FormDescription>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          {campaignLengths.map((length) => (
                            <div
                              key={length.value}
                              onClick={() => field.onChange(length.value)}
                              className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                                field.value === length.value
                                  ? 'border-primary bg-primary/5'
                                  : 'border-gray-200 dark:border-gray-700 hover:border-primary/50'
                              }`}
                            >
                              <div className="font-semibold text-sm">{length.label}</div>
                              <div className="text-xs text-primary font-medium">{length.chapters}</div>
                              <div className="text-xs text-muted-foreground">{length.time}</div>
                              <div className="text-xs text-muted-foreground mt-1">{length.description}</div>
                            </div>
                          ))}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* World Map Location - where this adventure takes place */}
                  <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-700/50">
                    <div className="flex items-center gap-2 mb-3">
                      <MapPin className="h-5 w-5 text-amber-600" />
                      <h3 className="font-semibold text-amber-800 dark:text-amber-300">World Location</h3>
                    </div>
                    <p className="text-sm text-amber-700 dark:text-amber-400 mb-3">
                      Link this adventure to a location on the world map. Other players will see active adventures here.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="worldRegionId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Region</FormLabel>
                            <Select 
                              onValueChange={(value) => {
                                const numValue = value && value !== "none" ? parseInt(value) : null;
                                field.onChange(numValue);
                                setSelectedWorldRegion(numValue);
                                // Clear location when region changes
                                form.setValue('worldLocationId', null);
                              }} 
                              value={field.value?.toString() || "none"}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select a region" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="none">No specific region</SelectItem>
                                {worldRegions.map(region => (
                                  <SelectItem key={region.id} value={region.id.toString()}>
                                    {region.name} (Lvl {region.levelRange})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="worldLocationId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Specific Location</FormLabel>
                            <Select 
                              onValueChange={(value) => {
                                field.onChange(value && value !== "none" ? parseInt(value) : null);
                              }} 
                              value={field.value?.toString() || "none"}
                              disabled={!selectedWorldRegion && filteredWorldLocations.length === 0}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select a location (optional)" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="none">No specific location</SelectItem>
                                {filteredWorldLocations.map(location => (
                                  <SelectItem key={location.id} value={location.id.toString()}>
                                    {location.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                  
                  {Array.isArray(characters) && characters.length > 0 && (
                    <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                      <p className="text-sm font-medium mb-2">Your Characters <span className="text-muted-foreground font-normal">(optional — you can add characters after creating the campaign)</span></p>
                      <div className="space-y-2">
                        {(characters as any[]).map((character: any) => (
                          <div key={character.id} className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span className="h-1.5 w-1.5 rounded-full bg-primary/50" />
                            {character.name} — Level {character.level} {character.race} {character.class}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <Button
                    type="submit"
                    size="lg"
                    className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-lg shadow-orange-500/25"
                    disabled={createCampaign.isPending}
                  >
                    {createCampaign.isPending ? "Creating..." : "Create Campaign"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
          </motion.div>
        </TabsContent>
      </Tabs>
      </div>
    </div>
  );
}
