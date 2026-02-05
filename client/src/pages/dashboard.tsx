import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import CampaignPanel from "@/components/campaign/CampaignPanel";
import CampaignArchiveList from "@/components/campaign/CampaignArchiveList";
import AdventureHistory from "@/components/adventure/AdventureHistory";
import QuickStart from "@/components/onboarding/QuickStart";
import PlayerQuickStart from "@/components/PlayerQuickStart";
import SinceLastTime from "@/components/SinceLastTime";
import { WhatsNextModal, useWhatsNextModal } from "@/components/onboarding/WhatsNextModal";
import { Character, Campaign, SharedAdventure } from "@shared/schema";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/hooks/use-auth";
import { getQueryFn, queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Bookmark, Calendar, History, User, Users, Activity, Star, Play, Sparkles, Sword, Shield, ScrollText, ChevronDown, ChevronUp, Heart, Zap, Package, Scroll, BookOpen, HelpCircle, Store, Download, ArrowRight } from "lucide-react";
import { ReturnVisitorPrompt } from "@/components/learning/ReturnVisitorPrompt";
import { Badge } from "@/components/ui/badge";
import { HowToPlayPanel } from "@/components/ui/how-to-play-panel";
import { HearthReminder } from "@/components/HearthReminder";
import parchmentFrame from "@assets/image_1768600727955.png";
import creatorAvatar from "@assets/image_1769476073776.png";

export default function Dashboard() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const { toast } = useToast();
  
  // What's Next modal for new users after demo/learn-by-playing
  const { isOpen: whatsNextOpen, completedType, showModal: showWhatsNext, closeModal: closeWhatsNext } = useWhatsNextModal();
  
  // Portrait generation state
  const [generatingPortraitIds, setGeneratingPortraitIds] = useState<Set<number>>(new Set());
  
  // Portrait generation mutation
  const generatePortraitMutation = useMutation({
    mutationFn: async (characterId: number) => {
      const response = await apiRequest("POST", `/api/characters/${characterId}/generate-portrait`);
      return response.json();
    },
    onSuccess: (data, characterId) => {
      queryClient.invalidateQueries({ queryKey: ['/api/characters'] });
      setGeneratingPortraitIds(prev => {
        const next = new Set(prev);
        next.delete(characterId);
        return next;
      });
    },
    onError: (error: Error, characterId) => {
      setGeneratingPortraitIds(prev => {
        const next = new Set(prev);
        next.delete(characterId);
        return next;
      });
      toast({
        title: "Portrait Generation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  const generatePortraitIfMissing = (character: Character) => {
    if (!character.portraitUrl && !generatingPortraitIds.has(character.id)) {
      setGeneratingPortraitIds(prev => new Set(prev).add(character.id));
      generatePortraitMutation.mutate(character.id);
    }
  };
  
  // For user counter stats - shows total community size
  const [userStats, setUserStats] = useState({
    totalRegistered: 0,
    totalCharacters: 0,
    totalCampaigns: 0
  });

  // For campaign selection - persist in localStorage
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | null>(() => {
    const saved = localStorage.getItem('activeCampaignId');
    return saved ? parseInt(saved) : null;
  });
  
  // Persist active campaign selection to localStorage
  useEffect(() => {
    if (selectedCampaignId) {
      localStorage.setItem('activeCampaignId', selectedCampaignId.toString());
    }
  }, [selectedCampaignId]);

  const { data: characters = [], isLoading: charactersLoading } = useQuery<Character[]>({
    queryKey: ['/api/characters'],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const { data: featuredAdventures = [] } = useQuery<(SharedAdventure & { authorUsername?: string })[]>({
    queryKey: ['/api/trading-post/adventures/featured'],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const { data: campaigns = [], isLoading: campaignsLoading, isError: campaignsError, refetch: refetchCampaigns } = useQuery<Campaign[]>({
    queryKey: ['/api/campaigns'],
    queryFn: getQueryFn({ on401: "throw" }),
    retry: 3,
    retryDelay: 1000,
    staleTime: 30000, // Data considered fresh for 30 seconds
  });

  // Fetch user stats
  useEffect(() => {
    // Function to fetch real user stats from the API
    const fetchUserStats = async () => {
      try {
        const response = await fetch('/api/user-stats');
        if (response.ok) {
          const data = await response.json();
          setUserStats({
            totalRegistered: data.totalRegistered,
            totalCharacters: data.totalCharacters || 0,
            totalCampaigns: data.totalCampaigns || 0
          });
        } else {
          console.error('Failed to fetch user stats:', response.statusText);
        }
      } catch (error) {
        console.error('Error fetching user stats:', error);
      }
    };
    
    // Initial fetch
    fetchUserStats();
    
    // Set up periodic refresh of user stats (every 60 seconds)
    const userStatsTimer = setInterval(fetchUserStats, 60000);
    
    return () => clearInterval(userStatsTimer);
  }, []);

  // Auto-refresh campaigns data every 15 seconds
  useEffect(() => {
    // Only attempt to refresh data if user is authenticated
    if (!user) return;
    
    console.log("Setting up campaign refresh timer for authenticated user");
    
    // Initial data load - useful after a session restore
    queryClient.invalidateQueries({
      queryKey: ['/api/campaigns']
    });
    
    // For active campaigns, also refresh their session data
    if (campaigns && campaigns.length > 0) {
      campaigns.forEach(campaign => {
        if (!campaign.isArchived && !campaign.isCompleted) {
          queryClient.invalidateQueries({
            queryKey: [`/api/campaigns/${campaign.id}/sessions`]
          });
        }
      });
    }
    
    // Set up periodic campaign data refresh
    const refreshTimer = setInterval(() => {
      // Check if user is authenticated
      if (user) {
        console.log("Auto-refreshing campaign data");
        // Refresh campaign list
        queryClient.invalidateQueries({
          queryKey: ['/api/campaigns']
        });
        
        // Also refresh session data for active campaigns
        if (campaigns && campaigns.length > 0) {
          campaigns.forEach(campaign => {
            if (!campaign.isArchived && !campaign.isCompleted) {
              queryClient.invalidateQueries({
                queryKey: [`/api/campaigns/${campaign.id}/sessions`]
              });
            }
          });
        }
      }
    }, 15000);
    
    // Clean up the interval when the component unmounts
    return () => clearInterval(refreshTimer);
  }, [user, campaigns]);
  
  // If campaign data error occurs, try to recover
  useEffect(() => {
    if (campaignsError) {
      // Wait a moment and retry fetching campaigns
      const recoveryTimer = setTimeout(() => {
        console.log("Attempting to recover from campaigns error");
        refetchCampaigns();
      }, 2000);
      
      return () => clearTimeout(recoveryTimer);
    }
  }, [campaignsError, refetchCampaigns]);
  
  // Get available campaigns (non-archived, non-completed)
  const availableCampaigns = campaigns?.filter(campaign => !campaign.isArchived && !campaign.isCompleted) || [];
  
  // Auto-select first campaign if none selected (or saved one doesn't exist) and campaigns are available
  useEffect(() => {
    if (availableCampaigns.length > 0) {
      // Check if saved campaign still exists in available campaigns
      const savedExists = selectedCampaignId && availableCampaigns.some(c => c.id === selectedCampaignId);
      
      if (!savedExists) {
        // Auto-select the most recently created campaign
        const mostRecent = [...availableCampaigns].sort((a, b) => {
          const dateA = new Date(a.createdAt);
          const dateB = new Date(b.createdAt);
          return dateB.getTime() - dateA.getTime();
        })[0];
        setSelectedCampaignId(mostRecent.id);
      }
    }
  }, [selectedCampaignId, availableCampaigns]);
  
  // Helper function to set a campaign as active
  const setAsActiveAdventure = (campaignId: number) => {
    setSelectedCampaignId(campaignId);
  };

  // Get active campaign based on selection
  const activeCampaign = selectedCampaignId ? campaigns?.find(c => c.id === selectedCampaignId) : null;

  // Fetch participants for active campaign to get the user's character
  const { data: participants = [], isLoading: participantsLoading } = useQuery<any[]>({
    queryKey: [`/api/campaigns/${activeCampaign?.id}/participants`],
    enabled: !!activeCampaign?.id,
  });

  // Find the current user's character from participants
  const participantCharacter = useMemo(() => {
    if (!participants || !user) return null;
    const myParticipant = participants.find((p: any) => p.userId === user.id);
    if (myParticipant?.character) {
      return myParticipant.character;
    }
    return null;
  }, [participants, user]);

  // Use participant character if available, otherwise fallback to owned characters
  const activeCharacter = participantCharacter || (characters.length > 0 ? characters[0] : null);

  const isNewUser = characters.length === 0 && availableCampaigns.length === 0;
  const [showQuickStart, setShowQuickStart] = useState(false);
  const [showLearnByPlaying, setShowLearnByPlaying] = useState(false);
  const [isCharacterSheetExpanded, setIsCharacterSheetExpanded] = useState(false);

  return (
    <div className="pb-16 min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* What's Next Modal - shown after completing demo/learn campaigns */}
      <WhatsNextModal 
        isOpen={whatsNextOpen} 
        onClose={closeWhatsNext} 
        completedType={completedType} 
      />
      
      {/* Hero Section - Matching Groups page style */}
      <div className="container mx-auto px-4 py-8">
        <section className="relative overflow-hidden rounded-xl bg-gradient-to-br from-amber-900/40 via-orange-900/30 to-slate-900/40 border border-amber-500/20 p-8 mb-8">
          {/* Parchment background texture */}
          <div 
            className="absolute inset-0 opacity-25 rounded-xl"
            style={{
              backgroundImage: `url(${parchmentFrame})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              mixBlendMode: 'overlay'
            }}
          />
          {/* Fantasy decorative icons */}
          <div className="absolute top-4 right-8 opacity-15">
            <Sword className="h-20 w-20 text-amber-400 rotate-45" />
          </div>
          <div className="absolute top-12 right-24 opacity-10">
            <Shield className="h-16 w-16 text-amber-300" />
          </div>
          
          <div className="relative z-10">
          <div className="max-w-2xl">
            {/* Community stats badge */}
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm">
                <Users className="h-3 w-3" />
                <span>{userStats.totalRegistered.toLocaleString()} adventurers have joined</span>
              </div>
              {userStats.totalCampaigns > 0 && (
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
                  <ScrollText className="h-3 w-3" />
                  <span>{userStats.totalCampaigns.toLocaleString()} campaigns played so far</span>
                </div>
              )}
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-sm">
                <img src={creatorAvatar} alt="KoeppyLoco" className="w-5 h-5 rounded-full object-cover" />
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span>KoeppyLoco is online</span>
              </div>
            </div>
            
            {/* Feedback link */}
            <div className="text-xs text-white/50 mb-3">
              <span>Questions or ideas? </span>
              <a 
                href="mailto:drkoepsell@gmail.com?subject=Everdice Feedback" 
                className="text-amber-400/80 hover:text-amber-400 underline underline-offset-2"
              >
                Send feedback to KoeppyLoco
              </a>
              <span> — we read everything!</span>
            </div>
            
            <h1 className="text-3xl md:text-4xl font-fantasy font-bold text-white mb-3">
              {user ? `Welcome back, ${user.username}!` : 'Begin Your Adventure'}
            </h1>
            <p className="text-lg text-white/70 mb-6">
              {activeCampaign 
                ? `Your quest awaits in "${activeCampaign.title}"`
                : "Learn to play, create adventures, and join a community of storytellers."}
            </p>
            <div className="flex flex-wrap gap-3">
              {activeCampaign && (
                <Button className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold px-6 py-2.5 rounded-lg shadow-lg shadow-amber-500/25 transition-all hover:shadow-amber-500/40">
                  <Play className="mr-2 h-4 w-4" />
                  Continue Adventure
                </Button>
              )}
              <Button 
                onClick={() => {
                  setShowLearnByPlaying(true);
                  setShowQuickStart(false);
                }}
                className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-semibold px-6 py-2.5 rounded-lg shadow-lg shadow-green-500/25 transition-all hover:shadow-green-500/40"
              >
                <BookOpen className="mr-2 h-4 w-4" />
                Learn by Playing
              </Button>
              {!activeCampaign && (
                <Button 
                  onClick={() => {
                    setShowQuickStart(true);
                    setShowLearnByPlaying(false);
                  }}
                  variant="outline"
                  className="border-white/20 text-white/90 hover:bg-white/10 hover:border-white/30"
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  Quick Start
                </Button>
              )}
              <Link href="/campaigns">
                <Button variant="outline" className="border-white/20 text-white/90 hover:bg-white/10 hover:border-white/30">
                  {activeCampaign ? 'All Adventures' : 'Browse Adventures'}
                </Button>
              </Link>
            </div>
          </div>
        </div>
        </section>
      </div>
      
      {/* Learn by Playing - Solo adventure with companion */}
      {showLearnByPlaying && !showQuickStart && (
        <section className="container mx-auto px-4 py-8 -mt-4">
          <Card className="border-2 border-green-500/30 bg-gradient-to-br from-green-500/5 to-emerald-500/5">
            <CardContent className="p-6">
              <PlayerQuickStart 
                onComplete={(campaignId, characterId) => {
                  setShowLearnByPlaying(false);
                  setShowQuickStart(false);
                  setSelectedCampaignId(campaignId);
                }}
                onCancel={() => {
                  setShowLearnByPlaying(false);
                  setShowQuickStart(false);
                }}
              />
            </CardContent>
          </Card>
        </section>
      )}

      {/* Quick Start Modal for new users */}
      {showQuickStart && !showLearnByPlaying && !activeCampaign && (
        <section className="container mx-auto px-4 py-8 -mt-4">
          <QuickStart 
            existingCharacters={characters} 
            onComplete={() => {
              setShowQuickStart(false);
              setShowLearnByPlaying(false);
            }} 
          />
        </section>
      )}

      {/* Return Visitor Prompt - gentle nudge to try new modes */}
      {!showLearnByPlaying && !showQuickStart && availableCampaigns.length > 0 && (
        <section className="container mx-auto px-4 pt-2">
          <ReturnVisitorPrompt 
            userName={user?.username}
            hasSoloSession={availableCampaigns.length > 0}
            onDismiss={() => {}}
          />
        </section>
      )}

      {/* Since Last Time... - World memory updates */}
      {activeCampaign && !showLearnByPlaying && !showQuickStart && (
        <section className="container mx-auto px-4 py-4 -mt-2">
          <SinceLastTime campaignId={activeCampaign.id} />
        </section>
      )}

      {/* Mobile Dashboard Tabs */}
      {isMobile && (
        <div className="container mx-auto px-4 py-6">
          <Tabs defaultValue="active-campaign" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="active-campaign" className="flex flex-col items-center text-xs">
                <Bookmark className="h-4 w-4 mb-1" />
                Adventure
              </TabsTrigger>
              <TabsTrigger value="character" className="flex flex-col items-center text-xs">
                <User className="h-4 w-4 mb-1" />
                Character
              </TabsTrigger>
              <TabsTrigger value="history" className="flex flex-col items-center text-xs">
                <History className="h-4 w-4 mb-1" />
                History
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="active-campaign" className="mt-4">
              {campaignsLoading ? (
                <Card>
                  <CardContent className="p-6">
                    <div className="animate-pulse space-y-4">
                      <div className="h-6 bg-gray-300 rounded w-3/4"></div>
                      <div className="h-60 bg-gray-300 rounded"></div>
                      <div className="h-6 bg-gray-300 rounded w-1/2"></div>
                    </div>
                  </CardContent>
                </Card>
              ) : campaignsError ? (
                <Card className="bg-secondary-light rounded-lg shadow-xl overflow-hidden">
                  <CardHeader className="bg-primary p-4">
                    <CardTitle className="font-fantasy text-xl font-bold text-white">Campaign Data</CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 flex flex-col items-center justify-center min-h-[300px]">
                    <div className="text-center">
                      <p className="text-lg mb-4 text-secondary">Unable to load campaign data</p>
                      <Button 
                        className="bg-primary-light hover:bg-primary-dark text-white"
                        onClick={() => refetchCampaigns()}
                      >
                        Retry Loading
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : activeCampaign ? (
                <div className="space-y-4">
                  {/* Mobile Active Adventure Header */}
                  <Card className="border-2 border-amber-500/50">
                    <CardHeader className="pb-2 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30">
                      <div className="flex items-center gap-2">
                        <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                        <CardTitle className="text-base font-fantasy">Active Adventure</CardTitle>
                        <Badge variant="outline" className="text-xs bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/50 dark:text-amber-200 dark:border-amber-700">
                          <Play className="h-2 w-2 mr-1" /> Playing
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-3 pb-3">
                      {availableCampaigns.length > 1 ? (
                        <Select 
                          value={selectedCampaignId?.toString() || ""} 
                          onValueChange={(value) => setAsActiveAdventure(parseInt(value))}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select a campaign" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableCampaigns.map((campaign) => (
                              <SelectItem key={campaign.id} value={campaign.id.toString()}>
                                <div className="flex items-center gap-2">
                                  {selectedCampaignId === campaign.id && <Star className="h-3 w-3 text-amber-500 fill-amber-500" />}
                                  {campaign.title} (Session {campaign.currentSession})
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{activeCampaign.title}</span>
                          <Badge variant="secondary" className="text-xs">Session {activeCampaign.currentSession}</Badge>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                  <CampaignPanel campaign={activeCampaign} />
                </div>
              ) : (
                <Card className="bg-secondary-light rounded-lg shadow-xl overflow-hidden">
                  <CardHeader className="bg-primary p-4">
                    <CardTitle className="font-fantasy text-xl font-bold text-white">Start a New Adventure</CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 flex flex-col items-center justify-center min-h-[300px]">
                    <div className="text-center">
                      <p className="text-lg mb-4 text-secondary">No active campaigns found</p>
                      <Link href="/campaigns">
                        <Button className="bg-primary-light hover:bg-primary-dark text-white">Create Campaign</Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              )}
              
              <div className="mt-4">
                <CampaignArchiveList />
              </div>
            </TabsContent>
            
            <TabsContent value="character" className="mt-4">
              {charactersLoading ? (
                <Card>
                  <CardContent className="p-6">
                    <div className="animate-pulse space-y-4">
                      <div className="h-6 bg-gray-300 rounded w-3/4"></div>
                      <div className="h-40 bg-gray-300 rounded"></div>
                    </div>
                  </CardContent>
                </Card>
              ) : activeCharacter ? (
                <Card className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-slate-800 dark:to-slate-900 border-2 border-amber-200 dark:border-amber-800/50">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="font-fantasy text-xl text-amber-900 dark:text-amber-100">{activeCharacter.name}</CardTitle>
                        <CardDescription className="text-amber-700 dark:text-amber-300">
                          Level {activeCharacter.level} {activeCharacter.race} {activeCharacter.class}
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <div className="text-center px-3 py-1 bg-red-100 dark:bg-red-900/30 rounded-lg">
                          <p className="text-xs text-red-600 dark:text-red-400">HP</p>
                          <p className="font-bold text-red-700 dark:text-red-300">{activeCharacter.hitPoints}/{activeCharacter.maxHitPoints}</p>
                        </div>
                        <div className="text-center px-3 py-1 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                          <p className="text-xs text-blue-600 dark:text-blue-400">AC</p>
                          <p className="font-bold text-blue-700 dark:text-blue-300">{activeCharacter.armorClass}</p>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-2">
                    <div className="grid grid-cols-6 gap-2 text-center">
                      {[
                        { name: 'STR', value: activeCharacter.strength },
                        { name: 'DEX', value: activeCharacter.dexterity },
                        { name: 'CON', value: activeCharacter.constitution },
                        { name: 'INT', value: activeCharacter.intelligence },
                        { name: 'WIS', value: activeCharacter.wisdom },
                        { name: 'CHA', value: activeCharacter.charisma },
                      ].map(stat => (
                        <div key={stat.name} className="bg-white/50 dark:bg-slate-700/50 rounded-lg p-2">
                          <p className="text-xs text-muted-foreground">{stat.name}</p>
                          <p className="font-bold">{stat.value}</p>
                          <p className="text-xs text-muted-foreground">
                            {Math.floor((stat.value - 10) / 2) >= 0 ? '+' : ''}{Math.floor((stat.value - 10) / 2)}
                          </p>
                        </div>
                      ))}
                    </div>
                    <Link href="/characters" className="block mt-4">
                      <Button variant="outline" className="w-full">View Full Character Sheet</Button>
                    </Link>
                  </CardContent>
                </Card>
              ) : (
                <Card className="bg-secondary-light rounded-lg shadow-xl overflow-hidden">
                  <CardHeader className="bg-primary p-4">
                    <CardTitle className="font-fantasy text-xl font-bold text-white">Create a Character</CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 flex flex-col items-center justify-center min-h-[200px]">
                    <div className="text-center">
                      <p className="text-lg mb-4 text-secondary">No characters found</p>
                      <Link href="/characters">
                        <Button className="bg-primary-light hover:bg-primary-dark text-white">Create Character</Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
            
            <TabsContent value="history" className="mt-4">
              <AdventureHistory />
            </TabsContent>
          </Tabs>
        </div>
      )}

      {/* Desktop Dashboard Content */}
      {!isMobile && (
        <div className="container mx-auto px-4 py-8">
          {/* Character Quick Stats Bar - Expandable to full sheet */}
          {activeCharacter && (
            <Card className="mb-6 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-slate-800 dark:to-slate-900 border-2 border-amber-200 dark:border-amber-800/50">
              <CardContent className="py-4">
                {/* Compact Stats Bar */}
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-4">
                    <div 
                      className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center overflow-hidden relative cursor-pointer"
                      onClick={() => !activeCharacter.portraitUrl && generatePortraitIfMissing(activeCharacter)}
                      title={!activeCharacter.portraitUrl ? "Click to generate portrait" : activeCharacter.name}
                    >
                      {activeCharacter.portraitUrl ? (
                        <img 
                          src={activeCharacter.portraitUrl} 
                          alt={activeCharacter.name}
                          className="w-full h-full object-cover"
                        />
                      ) : generatingPortraitIds.has(activeCharacter.id) ? (
                        <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                      ) : (
                        <User className="h-6 w-6 text-white" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-fantasy text-lg font-bold text-amber-900 dark:text-amber-100">{activeCharacter.name}</h3>
                      <p className="text-sm text-amber-700 dark:text-amber-300">
                        Level {activeCharacter.level} {activeCharacter.race} {activeCharacter.class}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-6">
                    {/* Core Stats */}
                    <div className="flex gap-3">
                      <div className="text-center px-3 py-1 bg-red-100 dark:bg-red-900/30 rounded-lg">
                        <p className="text-xs text-red-600 dark:text-red-400">HP</p>
                        <p className="font-bold text-red-700 dark:text-red-300">{activeCharacter.hitPoints || 0}/{activeCharacter.maxHitPoints || 0}</p>
                      </div>
                      <div className="text-center px-3 py-1 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                        <p className="text-xs text-blue-600 dark:text-blue-400">AC</p>
                        <p className="font-bold text-blue-700 dark:text-blue-300">{activeCharacter.armorClass || 10}</p>
                      </div>
                    </div>
                    
                    {/* Ability Scores - Compact */}
                    <div className="hidden md:flex gap-2">
                      {[
                        { name: 'STR', value: activeCharacter.strength || 10 },
                        { name: 'DEX', value: activeCharacter.dexterity || 10 },
                        { name: 'CON', value: activeCharacter.constitution || 10 },
                        { name: 'INT', value: activeCharacter.intelligence || 10 },
                        { name: 'WIS', value: activeCharacter.wisdom || 10 },
                        { name: 'CHA', value: activeCharacter.charisma || 10 },
                      ].map(stat => (
                        <div key={stat.name} className="text-center px-2 py-1 bg-white/50 dark:bg-slate-700/50 rounded">
                          <p className="text-xs text-muted-foreground">{stat.name}</p>
                          <p className="font-bold text-sm">{stat.value}</p>
                        </div>
                      ))}
                    </div>
                    
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setIsCharacterSheetExpanded(!isCharacterSheetExpanded)}
                      className="flex items-center gap-1"
                    >
                      {isCharacterSheetExpanded ? (
                        <>
                          <ChevronUp className="h-4 w-4" />
                          Collapse
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-4 w-4" />
                          Full Sheet
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Expanded Character Sheet */}
                {isCharacterSheetExpanded && (
                  <div className="mt-6 pt-6 border-t border-amber-200 dark:border-amber-800/50">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {/* Left Column - Character Details & Ability Scores */}
                      <div className="space-y-4">
                        <div className="bg-white/50 dark:bg-slate-700/50 rounded-lg p-4">
                          <h4 className="font-fantasy text-sm font-bold text-amber-800 dark:text-amber-200 mb-3 flex items-center gap-2">
                            <User className="h-4 w-4" />
                            Character Details
                          </h4>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Race:</span>
                              <span className="font-medium">{activeCharacter.race}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Class:</span>
                              <span className="font-medium">{activeCharacter.class}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Level:</span>
                              <span className="font-medium">{activeCharacter.level}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">XP:</span>
                              <span className="font-medium">{activeCharacter.experience || 0}</span>
                            </div>
                          </div>
                        </div>

                        <div className="bg-white/50 dark:bg-slate-700/50 rounded-lg p-4">
                          <h4 className="font-fantasy text-sm font-bold text-amber-800 dark:text-amber-200 mb-3 flex items-center gap-2">
                            <Zap className="h-4 w-4" />
                            Ability Scores
                          </h4>
                          <div className="grid grid-cols-2 gap-2">
                            {[
                              { name: 'Strength', abbr: 'STR', value: activeCharacter.strength || 10 },
                              { name: 'Dexterity', abbr: 'DEX', value: activeCharacter.dexterity || 10 },
                              { name: 'Constitution', abbr: 'CON', value: activeCharacter.constitution || 10 },
                              { name: 'Intelligence', abbr: 'INT', value: activeCharacter.intelligence || 10 },
                              { name: 'Wisdom', abbr: 'WIS', value: activeCharacter.wisdom || 10 },
                              { name: 'Charisma', abbr: 'CHA', value: activeCharacter.charisma || 10 },
                            ].map(stat => {
                              const modifier = Math.floor((stat.value - 10) / 2);
                              const modifierStr = modifier >= 0 ? `+${modifier}` : `${modifier}`;
                              return (
                                <div key={stat.abbr} className="text-center p-2 bg-amber-100/50 dark:bg-amber-900/30 rounded">
                                  <p className="text-xs text-muted-foreground">{stat.abbr}</p>
                                  <p className="font-bold text-lg">{stat.value}</p>
                                  <p className="text-xs text-amber-600 dark:text-amber-400">({modifierStr})</p>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* Middle Column - Combat Stats */}
                      <div className="space-y-4">
                        <div className="bg-white/50 dark:bg-slate-700/50 rounded-lg p-4">
                          <h4 className="font-fantasy text-sm font-bold text-amber-800 dark:text-amber-200 mb-3 flex items-center gap-2">
                            <Heart className="h-4 w-4" />
                            Combat Stats
                          </h4>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="text-center p-3 bg-red-100 dark:bg-red-900/30 rounded-lg">
                              <p className="text-xs text-red-600 dark:text-red-400">Hit Points</p>
                              <p className="font-bold text-xl text-red-700 dark:text-red-300">
                                {activeCharacter.hitPoints || 0}/{activeCharacter.maxHitPoints || 0}
                              </p>
                            </div>
                            <div className="text-center p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                              <p className="text-xs text-blue-600 dark:text-blue-400">Armor Class</p>
                              <p className="font-bold text-xl text-blue-700 dark:text-blue-300">{activeCharacter.armorClass || 10}</p>
                            </div>
                            <div className="text-center p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                              <p className="text-xs text-purple-600 dark:text-purple-400">Initiative</p>
                              <p className="font-bold text-xl text-purple-700 dark:text-purple-300">
                                {(() => {
                                  const dexMod = Math.floor(((activeCharacter.dexterity || 10) - 10) / 2);
                                  return dexMod >= 0 ? `+${dexMod}` : dexMod;
                                })()}
                              </p>
                            </div>
                            <div className="text-center p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                              <p className="text-xs text-green-600 dark:text-green-400">Speed</p>
                              <p className="font-bold text-xl text-green-700 dark:text-green-300">{activeCharacter.speed || 30}ft</p>
                            </div>
                          </div>
                        </div>

                        <div className="bg-white/50 dark:bg-slate-700/50 rounded-lg p-4">
                          <h4 className="font-fantasy text-sm font-bold text-amber-800 dark:text-amber-200 mb-3 flex items-center gap-2">
                            <Sword className="h-4 w-4" />
                            Attack Bonuses
                          </h4>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between items-center p-2 bg-amber-100/50 dark:bg-amber-900/30 rounded">
                              <span>Melee Attack</span>
                              <Badge variant="outline" className="bg-orange-100 dark:bg-orange-900/30">
                                {(() => {
                                  const strMod = Math.floor(((activeCharacter.strength || 10) - 10) / 2);
                                  const profBonus = Math.ceil((activeCharacter.level || 1) / 4) + 1;
                                  const total = strMod + profBonus;
                                  return total >= 0 ? `+${total}` : total;
                                })()}
                              </Badge>
                            </div>
                            <div className="flex justify-between items-center p-2 bg-amber-100/50 dark:bg-amber-900/30 rounded">
                              <span>Ranged Attack</span>
                              <Badge variant="outline" className="bg-orange-100 dark:bg-orange-900/30">
                                {(() => {
                                  const dexMod = Math.floor(((activeCharacter.dexterity || 10) - 10) / 2);
                                  const profBonus = Math.ceil((activeCharacter.level || 1) / 4) + 1;
                                  const total = dexMod + profBonus;
                                  return total >= 0 ? `+${total}` : total;
                                })()}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Right Column - Equipment & Background */}
                      <div className="space-y-4">
                        <div className="bg-white/50 dark:bg-slate-700/50 rounded-lg p-4">
                          <h4 className="font-fantasy text-sm font-bold text-amber-800 dark:text-amber-200 mb-3 flex items-center gap-2">
                            <Package className="h-4 w-4" />
                            Equipment
                          </h4>
                          {(() => {
                            const equipmentList: any[] = Array.isArray(activeCharacter.equipment) ? activeCharacter.equipment : [];
                            const parseItem = (item: any): string => {
                              if (typeof item === 'object' && item !== null) {
                                return item.name || 'Unknown Item';
                              }
                              if (typeof item === 'string') {
                                try {
                                  const parsed = JSON.parse(item);
                                  return parsed.name || item;
                                } catch {
                                  return item;
                                }
                              }
                              return String(item);
                            };
                            return equipmentList.length > 0 ? (
                              <ul className="space-y-1 text-sm max-h-32 overflow-y-auto">
                                {equipmentList.slice(0, 8).map((item: any, idx: number) => (
                                  <li key={idx} className="flex items-center gap-2 text-muted-foreground">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                    {parseItem(item)}
                                  </li>
                                ))}
                                {equipmentList.length > 8 && (
                                  <li className="text-xs text-muted-foreground italic">
                                    +{equipmentList.length - 8} more items
                                  </li>
                                )}
                              </ul>
                            ) : (
                              <p className="text-sm text-muted-foreground italic">No equipment</p>
                            );
                          })()}
                        </div>

                        <div className="bg-white/50 dark:bg-slate-700/50 rounded-lg p-4">
                          <h4 className="font-fantasy text-sm font-bold text-amber-800 dark:text-amber-200 mb-3 flex items-center gap-2">
                            <Scroll className="h-4 w-4" />
                            Background
                          </h4>
                          {activeCharacter.background ? (
                            <p className="text-sm text-muted-foreground line-clamp-4">
                              {activeCharacter.background}
                            </p>
                          ) : (
                            <p className="text-sm text-muted-foreground italic">No background story</p>
                          )}
                        </div>

                        {/* Spellcaster indicator */}
                        {['wizard', 'sorcerer', 'cleric', 'bard', 'druid', 'warlock', 'paladin', 'ranger'].includes(activeCharacter.class?.toLowerCase() || '') && (
                          <div className="bg-purple-100/50 dark:bg-purple-900/30 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
                            <h4 className="font-fantasy text-sm font-bold text-purple-800 dark:text-purple-200 mb-2 flex items-center gap-2">
                              <Sparkles className="h-4 w-4" />
                              Spellcaster
                            </h4>
                            <p className="text-xs text-muted-foreground mb-2">
                              View your spells in the full character sheet.
                            </p>
                            <Link href="/characters">
                              <Button variant="outline" size="sm" className="text-purple-600 dark:text-purple-400 border-purple-300 dark:border-purple-700 text-xs">
                                <Sparkles className="h-3 w-3 mr-1" />
                                Open Spell Book
                              </Button>
                            </Link>
                          </div>
                        )}

                        <div className="text-center">
                          <Link href="/characters">
                            <Button variant="link" size="sm" className="text-amber-600 dark:text-amber-400">
                              Edit Character
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
          
          {/* Main Adventure Content - Full Width Focus */}
          <div className="space-y-8">
              {/* Campaign Panel */}
              {campaignsLoading ? (
                <Card>
                  <CardContent className="p-6">
                    <div className="animate-pulse space-y-4">
                      <div className="h-6 bg-gray-300 rounded w-3/4"></div>
                      <div className="h-60 bg-gray-300 rounded"></div>
                      <div className="h-6 bg-gray-300 rounded w-1/2"></div>
                    </div>
                  </CardContent>
                </Card>
              ) : campaignsError ? (
                <Card className="bg-secondary-light rounded-lg shadow-xl overflow-hidden">
                  <CardHeader className="bg-primary p-4 flex justify-between items-center">
                    <CardTitle className="font-fantasy text-xl font-bold text-white">Current Adventure</CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 flex flex-col items-center justify-center h-[400px] bg-parchment character-sheet">
                    <div className="text-center">
                      <p className="text-lg mb-4 text-secondary">Unable to load campaign data</p>
                      <p className="text-sm text-gray-600 mb-4">There was a problem retrieving your campaign information.</p>
                      <Button 
                        className="bg-primary-light hover:bg-primary-dark text-white"
                        onClick={() => refetchCampaigns()}
                      >
                        Retry Loading
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : activeCampaign ? (
                <div className="space-y-6">
                  {/* Active Adventure Header - Compact with dropdown */}
                  <div className="flex items-center justify-between bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/40 px-4 py-2 rounded-lg border border-amber-300 dark:border-amber-700">
                    <div className="flex items-center gap-3">
                      <Star className="h-5 w-5 text-amber-500 fill-amber-500" />
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-slate-100">{activeCampaign.title}</span>
                        <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/50 dark:text-amber-200 dark:border-amber-700 text-xs">
                          Ch. {activeCampaign.currentSession}
                        </Badge>
                      </div>
                    </div>
                    {availableCampaigns.length > 1 && (
                      <Select
                        value={selectedCampaignId?.toString() || ''}
                        onValueChange={(value) => setAsActiveAdventure(parseInt(value))}
                      >
                        <SelectTrigger className="w-auto border-amber-400 text-amber-700 dark:text-amber-300 bg-white dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-amber-900/30">
                          <div className="flex items-center gap-2">
                            <BookOpen className="h-4 w-4" />
                            <span className="hidden sm:inline">Switch Adventure</span>
                            <span className="sm:hidden">Switch</span>
                          </div>
                        </SelectTrigger>
                        <SelectContent>
                          {availableCampaigns.map((campaign) => (
                            <SelectItem key={campaign.id} value={campaign.id.toString()}>
                              <div className="flex items-center gap-2">
                                {campaign.id === selectedCampaignId && <Star className="h-3 w-3 text-amber-500 fill-amber-500" />}
                                <span>{campaign.title}</span>
                                <span className="text-xs text-muted-foreground">Ch. {campaign.currentSession}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  <CampaignPanel campaign={activeCampaign} />
                </div>
              ) : (
                <Card className="bg-secondary-light rounded-lg shadow-xl overflow-hidden">
                  <CardHeader className="bg-primary p-4 flex justify-between items-center">
                    <CardTitle className="font-fantasy text-xl font-bold text-white">Current Adventure</CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 flex flex-col items-center justify-center h-[400px] bg-parchment character-sheet">
                    <div className="text-center">
                      <p className="text-lg mb-4 text-secondary">No active campaigns found</p>
                      <Link href="/campaigns">
                        <Button className="bg-primary-light hover:bg-primary-dark text-white">Create Campaign</Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              )}
              
              {/* Adventure History Section */}
              <Card className="overflow-hidden">
                <CardHeader className="bg-primary p-4">
                  <CardTitle className="font-fantasy text-xl font-bold text-white flex items-center">
                    <Calendar className="mr-2 h-5 w-5" />
                    Adventure Progress
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <AdventureHistory />
                </CardContent>
              </Card>
              
              {/* Campaign Archive */}
              <Card className="overflow-hidden">
                <CardHeader className="bg-primary p-4">
                  <CardTitle className="font-fantasy text-xl font-bold text-white flex items-center">
                    <Bookmark className="mr-2 h-5 w-5" />
                    Campaign Management
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <CampaignArchiveList />
                </CardContent>
              </Card>
          </div>
        </div>
      )}
      
      {/* Trending from the Trading Post */}
      {featuredAdventures.length > 0 && (
        <div className="container mx-auto px-4 mt-8">
          <Card className="overflow-hidden border-amber-500/20 bg-gradient-to-br from-slate-900/80 to-amber-900/10">
            <CardHeader className="bg-gradient-to-r from-amber-900/40 to-orange-900/30 p-4">
              <div className="flex items-center justify-between">
                <CardTitle className="font-fantasy text-xl font-bold text-white flex items-center">
                  <Store className="mr-2 h-5 w-5 text-amber-400" />
                  Trending from the Trading Post
                </CardTitle>
                <Link href="/trading-post">
                  <Button variant="ghost" size="sm" className="text-amber-300 hover:text-amber-200 hover:bg-amber-900/30">
                    Browse All <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                </Link>
              </div>
              <CardDescription className="text-amber-200/70">Community-shared adventures ready to play</CardDescription>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {featuredAdventures.slice(0, 3).map((adventure) => (
                  <Link key={adventure.id} href="/trading-post">
                    <Card className="cursor-pointer hover:border-amber-500/40 transition-all hover:shadow-lg hover:shadow-amber-500/10 bg-slate-800/50 border-slate-700/50 h-full">
                      <div className="relative h-32 overflow-hidden rounded-t-lg">
                        {adventure.coverImageUrl ? (
                          <img src={adventure.coverImageUrl} alt={adventure.title} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-amber-900/60 to-orange-900/40 flex items-center justify-center">
                            <Scroll className="h-10 w-10 text-amber-400/50" />
                          </div>
                        )}
                        <div className="absolute top-2 right-2">
                          <Badge className={`text-xs ${
                            adventure.difficulty === 'easy' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                            adventure.difficulty === 'hard' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                            adventure.difficulty === 'deadly' ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' :
                            'bg-amber-500/20 text-amber-400 border-amber-500/30'
                          }`}>
                            {adventure.difficulty}
                          </Badge>
                        </div>
                      </div>
                      <CardContent className="p-3">
                        <h3 className="font-fantasy text-sm font-bold text-amber-200 line-clamp-1">{adventure.title}</h3>
                        <p className="text-xs text-muted-foreground mt-1">by {adventure.authorUsername || 'Unknown'}</p>
                        <p className="text-xs text-slate-400 mt-1 line-clamp-2">{adventure.shortDescription || adventure.description}</p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <Star className="h-3 w-3 text-amber-400" />
                            {adventure.avgRating ? (adventure.avgRating / 10).toFixed(1) : 'New'}
                          </span>
                          <span className="flex items-center gap-1">
                            <Download className="h-3 w-3" />
                            {adventure.downloadCount || 0}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Gentle reassurance for new users */}
      <div className="container mx-auto px-4 mt-12 mb-4">
        <p className="text-center text-sm text-muted-foreground/70 italic">
          Most tables play weekly. Everything you set up here will be waiting when game night comes.
        </p>
      </div>
      
      {/* How to Play floating button for new users */}
      <div className="fixed bottom-6 right-6 z-40">
        <HowToPlayPanel
          variant="button"
          triggerClassName="shadow-lg bg-gradient-to-r from-amber-600 to-orange-600 text-white hover:from-amber-500 hover:to-orange-500 border-0"
        />
      </div>
      
      {/* Hearth reminder popup */}
      <HearthReminder />
    </div>
  );
}
