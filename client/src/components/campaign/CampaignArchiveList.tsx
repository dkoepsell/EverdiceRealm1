import { Campaign, Character } from "@shared/schema";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";
import { Archive, Bookmark, Calendar, CheckCircle, ChevronRight, Clock, RefreshCw, Trash, User, Users } from "lucide-react";
import { formatDistance } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
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

export default function CampaignArchiveList() {
  const [activeTab, setActiveTab] = useState("active");
  const { toast } = useToast();
  
  // Query to fetch all campaigns
  const {
    data: campaigns = [],
    isLoading: isLoadingCampaigns,
    error: campaignsError,
  } = useQuery<Campaign[]>({
    queryKey: ["/api/campaigns"],
    queryFn: undefined,
  });
  
  // Query to fetch archived campaigns
  const {
    data: archivedCampaigns = [],
    isLoading: isLoadingArchived,
  } = useQuery<Campaign[]>({
    queryKey: ["/api/campaigns/archived"],
  });
  
  // Query to fetch character data for displaying in campaigns
  const {
    data: characters = [],
    isLoading: isLoadingCharacters,
  } = useQuery<Character[]>({
    queryKey: ["/api/characters"],
    queryFn: undefined,
  });

  // Mutation to archive a campaign
  const archiveMutation = useMutation({
    mutationFn: async (campaignId: number) => {
      await apiRequest("POST", `/api/campaigns/${campaignId}/archive`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns/archived"] });
      toast({
        title: "Campaign archived",
        description: "The campaign has been moved to the archive.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to archive campaign: ${error.message}`,
        variant: "destructive",
      });
    },
  });
  
  // Mutation to restore a campaign from archive
  const restoreMutation = useMutation({
    mutationFn: async (campaignId: number) => {
      await apiRequest("POST", `/api/campaigns/${campaignId}/restore`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns/archived"] });
      toast({
        title: "Campaign restored",
        description: "The campaign has been restored to active campaigns.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to restore campaign: ${error.message}`,
        variant: "destructive",
      });
    },
  });
  
  // Mutation to mark a campaign as complete
  const completeMutation = useMutation({
    mutationFn: async (campaignId: number) => {
      await apiRequest("POST", `/api/campaigns/${campaignId}/complete`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      toast({
        title: "Campaign completed",
        description: "The campaign has been marked as completed.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to complete campaign: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Mutation to delete a campaign
  const deleteMutation = useMutation({
    mutationFn: async (campaignId: number) => {
      await apiRequest("DELETE", `/api/campaigns/${campaignId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns/archived"] });
      toast({
        title: "Campaign deleted",
        description: "The campaign has been permanently deleted.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to delete campaign: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Filter active campaigns (not archived, not completed)
  const activeCampaigns = campaigns.filter(campaign => !campaign.isArchived && !campaign.isCompleted);
  // Filter completed campaigns (not archived, but completed)
  const completedCampaigns = campaigns.filter(campaign => !campaign.isArchived && campaign.isCompleted);

  // Fetch participants for all campaigns
  const { data: allParticipants = [] } = useQuery<any[]>({
    queryKey: ["/api/campaign-participants/all"],
    queryFn: async () => {
      // Fetch participants for each campaign
      const participantPromises = campaigns.map(async (campaign) => {
        try {
          const response = await fetch(`/api/campaigns/${campaign.id}/participants`);
          if (response.ok) {
            const participants = await response.json();
            return { campaignId: campaign.id, participants };
          }
        } catch (e) {
          // Ignore errors
        }
        return { campaignId: campaign.id, participants: [] };
      });
      return Promise.all(participantPromises);
    },
    enabled: campaigns.length > 0,
  });
  
  // Get character names for a campaign from participants
  const getCharacterNames = (campaignId: number) => {
    const campaignData = allParticipants.find((p: any) => p.campaignId === campaignId);
    if (!campaignData || !campaignData.participants || campaignData.participants.length === 0) {
      return "No characters assigned";
    }
    
    return campaignData.participants
      .filter((p: any) => p.character)
      .map((p: any) => p.character.name)
      .join(", ") || "No characters assigned";
  };

  // Handle loading states
  if (isLoadingCampaigns || isLoadingArchived || isLoadingCharacters) {
    return (
      <div className="space-y-4">
        <Tabs defaultValue="active">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
            <TabsTrigger value="archived">Archived</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-6 w-2/5" />
                <Skeleton className="h-4 w-4/5" />
              </CardHeader>
              <CardContent>
                <div className="flex flex-col space-y-2">
                  <Skeleton className="h-4 w-3/5" />
                  <Skeleton className="h-4 w-4/5" />
                  <Skeleton className="h-4 w-2/5" />
                </div>
              </CardContent>
              <CardFooter>
                <Skeleton className="h-10 w-24" />
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Handle errors
  if (campaignsError) {
    return (
      <div className="p-4 bg-red-100 border border-red-300 rounded-md text-red-800">
        <h3 className="font-bold">Error loading campaigns</h3>
        <p>{(campaignsError as Error).message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="active" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full sm:w-auto grid grid-cols-3">
          <TabsTrigger value="active">
            <Clock className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Active</span>
            <Badge variant="outline" className="ml-2">{activeCampaigns.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="completed">
            <CheckCircle className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Completed</span>
            <Badge variant="outline" className="ml-2">{completedCampaigns.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="archived">
            <Archive className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Archived</span>
            <Badge variant="outline" className="ml-2">{archivedCampaigns.length}</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-4 space-y-4">
          {activeCampaigns.length === 0 ? (
            <div className="text-center p-8 border rounded-md bg-muted/40">
              <h3 className="text-lg font-medium mb-2">No active campaigns</h3>
              <p className="text-muted-foreground mb-4">
                You don't have any active campaigns. Start a new adventure!
              </p>
              <Button variant="outline">Create Campaign</Button>
            </div>
          ) : (
            activeCampaigns.map((campaign) => (
              <Card key={campaign.id} className="overflow-hidden">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-xl font-bold">{campaign.title}</CardTitle>
                      <CardDescription>{campaign.description}</CardDescription>
                    </div>
                    <Badge>{campaign.difficulty}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="pb-2">
                  <div className="grid gap-2 text-sm">
                    <div className="flex items-center text-muted-foreground">
                      <Calendar className="mr-2 h-4 w-4" />
                      <span>Created {formatDistance(new Date(campaign.createdAt), new Date(), { addSuffix: true })}</span>
                    </div>
                    <div className="flex items-center text-muted-foreground">
                      <Users className="mr-2 h-4 w-4" />
                      <span>{getCharacterNames(campaign.id)}</span>
                    </div>
                    <div className="flex items-center text-muted-foreground">
                      <Bookmark className="mr-2 h-4 w-4" />
                      <span>Chapter {campaign.currentSession || 1}</span>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between pt-2 border-t">
                  <Button variant="ghost" size="sm">
                    Continue
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                  <div className="flex space-x-2">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Archive className="h-4 w-4" />
                          <span className="hidden sm:inline ml-2">Archive</span>
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Archive campaign?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will move the campaign to your archives. You can restore it later.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={() => archiveMutation.mutate(campaign.id)}
                            disabled={archiveMutation.isPending}
                          >
                            {archiveMutation.isPending ? "Archiving..." : "Archive"}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <CheckCircle className="h-4 w-4" />
                          <span className="hidden sm:inline ml-2">Complete</span>
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Mark as completed?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will mark the campaign as completed. Characters will receive XP rewards.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={() => completeMutation.mutate(campaign.id)}
                            disabled={completeMutation.isPending}
                          >
                            {completeMutation.isPending ? "Completing..." : "Complete"}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardFooter>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="completed" className="mt-4 space-y-4">
          {completedCampaigns.length === 0 ? (
            <div className="text-center p-8 border rounded-md bg-muted/40">
              <h3 className="text-lg font-medium mb-2">No completed campaigns</h3>
              <p className="text-muted-foreground">
                You haven't completed any campaigns yet.
              </p>
            </div>
          ) : (
            completedCampaigns.map((campaign) => (
              <Card key={campaign.id} className="overflow-hidden">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-xl font-bold group flex items-center">
                        {campaign.title}
                        <Badge className="ml-2 bg-green-100 text-green-800 border-green-200">Completed</Badge>
                      </CardTitle>
                      <CardDescription>{campaign.description}</CardDescription>
                    </div>
                    <Badge>{campaign.difficulty}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="pb-2">
                  <div className="grid gap-2 text-sm">
                    <div className="flex items-center text-muted-foreground">
                      <Calendar className="mr-2 h-4 w-4" />
                      <span>
                        Completed {campaign.completedAt ? formatDistance(new Date(campaign.completedAt), new Date(), { addSuffix: true }) : 'Unknown'}
                      </span>
                    </div>
                    <div className="flex items-center text-muted-foreground">
                      <Users className="mr-2 h-4 w-4" />
                      <span>{getCharacterNames(campaign.id)}</span>
                    </div>
                    <div className="flex items-center text-muted-foreground">
                      <Bookmark className="mr-2 h-4 w-4" />
                      <span>Chapter {campaign.currentSession || 1} of {campaign.totalChapters || '?'}</span>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between pt-2 border-t">
                  <Button variant="ghost" size="sm">
                    View Summary
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                  <div className="flex space-x-2">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Archive className="h-4 w-4" />
                          <span className="hidden sm:inline ml-2">Archive</span>
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Archive campaign?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will move the campaign to your archives. You can restore it later.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={() => archiveMutation.mutate(campaign.id)}
                            disabled={archiveMutation.isPending}
                          >
                            {archiveMutation.isPending ? "Archiving..." : "Archive"}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardFooter>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="archived" className="mt-4 space-y-4">
          {archivedCampaigns.length === 0 ? (
            <div className="text-center p-8 border rounded-md bg-muted/40">
              <h3 className="text-lg font-medium mb-2">No archived campaigns</h3>
              <p className="text-muted-foreground">
                You haven't archived any campaigns yet.
              </p>
            </div>
          ) : (
            archivedCampaigns.map((campaign) => (
              <Card key={campaign.id} className="overflow-hidden">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-xl font-bold group flex items-center">
                        {campaign.title}
                        <Badge className="ml-2 bg-gray-100 text-gray-800 border-gray-200">Archived</Badge>
                      </CardTitle>
                      <CardDescription>{campaign.description}</CardDescription>
                    </div>
                    <Badge>{campaign.difficulty}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="pb-2">
                  <div className="grid gap-2 text-sm">
                    <div className="flex items-center text-muted-foreground">
                      <Calendar className="mr-2 h-4 w-4" />
                      <span>Archived {formatDistance(new Date(campaign.updatedAt || campaign.createdAt), new Date(), { addSuffix: true })}</span>
                    </div>
                    <div className="flex items-center text-muted-foreground">
                      <Users className="mr-2 h-4 w-4" />
                      <span>{getCharacterNames(campaign.id)}</span>
                    </div>
                    <div className="flex items-center text-muted-foreground">
                      <Bookmark className="mr-2 h-4 w-4" />
                      <span>Chapter {campaign.currentSession || 1}</span>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between pt-2 border-t">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => restoreMutation.mutate(campaign.id)}
                    disabled={restoreMutation.isPending}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    {restoreMutation.isPending ? "Restoring..." : "Restore"}
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" className="text-red-500 hover:text-red-600">
                        <Trash className="h-4 w-4" />
                        <span className="hidden sm:inline ml-2">Delete</span>
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete campaign?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. This will permanently delete the campaign and all its sessions.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={() => deleteMutation.mutate(campaign.id)}
                          disabled={deleteMutation.isPending}
                          className="bg-red-500 hover:bg-red-600"
                        >
                          {deleteMutation.isPending ? "Deleting..." : "Delete"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </CardFooter>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}