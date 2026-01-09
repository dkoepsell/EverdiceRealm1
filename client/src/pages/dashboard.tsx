import { useQuery } from "@tanstack/react-query";
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
import { Character, Campaign } from "@shared/schema";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/hooks/use-auth";
import { getQueryFn, queryClient } from "@/lib/queryClient";
import { Bookmark, Calendar, History, User, Users, Activity, Star, Play, Sparkles, Sword, Shield, ScrollText } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function Dashboard() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  
  // For user counter stats
  const [userStats, setUserStats] = useState({
    totalRegistered: 0,
    onlineUsers: 0
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
            onlineUsers: data.onlineUsers
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

  return (
    <div className="pb-16 min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Hero Section - D&D-inspired branded design with Everdice identity */}
      <section className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-10 md:py-16 overflow-hidden">
        {/* Background decorative elements */}
        <div className="absolute inset-0 bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-transparent"></div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-1/4 w-64 h-64 bg-orange-500/5 rounded-full blur-2xl"></div>
        
        {/* Fantasy decorative icons */}
        <div className="absolute top-8 right-8 md:right-16 opacity-20">
          <Sword className="h-16 w-16 md:h-24 md:w-24 text-amber-400 rotate-45" />
        </div>
        <div className="absolute top-20 right-24 md:right-48 opacity-15">
          <Shield className="h-12 w-12 md:h-20 md:w-20 text-amber-300" />
        </div>
        <div className="absolute bottom-8 right-12 md:right-32 opacity-10">
          <ScrollText className="h-14 w-14 md:h-18 md:w-18 text-orange-300" />
        </div>
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-2xl">
            {/* Everdice brand mark */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/30">
                <span className="text-white font-fantasy font-bold text-xl">E</span>
              </div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm">
                <Activity className="h-3 w-3" />
                <span>{userStats.onlineUsers} adventurers online</span>
              </div>
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
              {activeCampaign ? (
                <Button className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold px-6 py-2.5 rounded-lg shadow-lg shadow-amber-500/25 transition-all hover:shadow-amber-500/40">
                  <Play className="mr-2 h-4 w-4" />
                  Continue Adventure
                </Button>
              ) : (
                <Button 
                  onClick={() => setShowQuickStart(true)}
                  className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold px-6 py-2.5 rounded-lg shadow-lg shadow-amber-500/25 transition-all hover:shadow-amber-500/40"
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
      
      {/* Quick Start Modal for new users */}
      {(showQuickStart || isNewUser) && !activeCampaign && (
        <section className="container mx-auto px-4 py-8 -mt-4">
          <QuickStart 
            existingCharacters={characters} 
            onComplete={() => setShowQuickStart(false)} 
          />
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
          {/* Character Quick Stats Bar - Compact horizontal display */}
          {activeCharacter && (
            <Card className="mb-6 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-slate-800 dark:to-slate-900 border-2 border-amber-200 dark:border-amber-800/50">
              <CardContent className="py-4">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                      <User className="h-6 w-6 text-white" />
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
                        <p className="font-bold text-red-700 dark:text-red-300">{activeCharacter.hitPoints}/{activeCharacter.maxHitPoints}</p>
                      </div>
                      <div className="text-center px-3 py-1 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                        <p className="text-xs text-blue-600 dark:text-blue-400">AC</p>
                        <p className="font-bold text-blue-700 dark:text-blue-300">{activeCharacter.armorClass}</p>
                      </div>
                    </div>
                    
                    {/* Ability Scores - Compact */}
                    <div className="hidden md:flex gap-2">
                      {[
                        { name: 'STR', value: activeCharacter.strength },
                        { name: 'DEX', value: activeCharacter.dexterity },
                        { name: 'CON', value: activeCharacter.constitution },
                        { name: 'INT', value: activeCharacter.intelligence },
                        { name: 'WIS', value: activeCharacter.wisdom },
                        { name: 'CHA', value: activeCharacter.charisma },
                      ].map(stat => (
                        <div key={stat.name} className="text-center px-2 py-1 bg-white/50 dark:bg-slate-700/50 rounded">
                          <p className="text-xs text-muted-foreground">{stat.name}</p>
                          <p className="font-bold text-sm">{stat.value}</p>
                        </div>
                      ))}
                    </div>
                    
                    <Link href="/characters">
                      <Button variant="outline" size="sm">Full Sheet</Button>
                    </Link>
                  </div>
                </div>
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
                  {/* Active Adventure Header */}
                  <Card className="border-2 border-amber-500/50">
                    <CardHeader className="pb-3 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Star className="h-5 w-5 text-amber-500 fill-amber-500" />
                          <CardTitle className="text-lg font-fantasy">Active Adventure</CardTitle>
                          <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/50 dark:text-amber-200 dark:border-amber-700">
                            <Play className="h-3 w-3 mr-1" /> Playing
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-4">
                      {availableCampaigns.length > 1 ? (
                        <div className="space-y-3">
                          <p className="text-sm text-muted-foreground">Choose which campaign to play:</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {availableCampaigns.map((campaign) => (
                              <Button
                                key={campaign.id}
                                variant={selectedCampaignId === campaign.id ? "default" : "outline"}
                                className={`justify-start h-auto py-3 px-4 ${selectedCampaignId === campaign.id ? 'bg-amber-600 hover:bg-amber-700 text-white' : ''}`}
                                onClick={() => setAsActiveAdventure(campaign.id)}
                                data-testid={`button-set-active-${campaign.id}`}
                              >
                                <div className="flex items-center gap-2 w-full">
                                  {selectedCampaignId === campaign.id && <Star className="h-4 w-4 fill-current" />}
                                  <div className="text-left">
                                    <div className="font-medium">{campaign.title}</div>
                                    <div className="text-xs opacity-80">Session {campaign.currentSession}</div>
                                  </div>
                                </div>
                              </Button>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                          <span className="font-medium">{activeCampaign.title}</span>
                          <Badge variant="secondary">Session {activeCampaign.currentSession}</Badge>
                        </div>
                      )}
                    </CardContent>
                  </Card>
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
    </div>
  );
}
