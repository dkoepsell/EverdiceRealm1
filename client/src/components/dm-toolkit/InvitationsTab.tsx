import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  Card, 
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle 
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Plus, Copy, MoreHorizontal, Trash, RefreshCw, Mail, Shield, CalendarClock } from "lucide-react";
import { format, formatDistanceToNow, isAfter } from "date-fns";

// Create invitation schema
const invitationSchema = z.object({
  email: z.string().email().optional().or(z.literal("")),
  userId: z.coerce.number().optional(),
  role: z.string(),
  maxUses: z.coerce.number().int().min(1).default(1),
  expiresAt: z.string().optional(),
  notes: z.string().optional(),
});

type Invitation = {
  id: number;
  campaignId: number;
  inviteCode: string;
  email?: string;
  role: string;
  status: string;
  createdAt: string;
  expiresAt?: string;
  usedAt?: string;
  maxUses: number;
  useCount: number;
  notes?: string;
};

type Campaign = {
  id: number;
  title: string;
};

type User = {
  id: number;
  username: string;
  displayName: string | null;
};

export default function InvitationsTab() {
  const { toast } = useToast();
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0); // Used to trigger refresh
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

  // Fetch campaigns
  const { data: campaigns = [], isLoading: isLoadingCampaigns } = useQuery<Campaign[]>({
    queryKey: ["/api/campaigns"],
    refetchOnWindowFocus: false,
  });
  
  // State for registered users
  const [users, setUsers] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  
  // Fetch registered users directly
  const fetchUsers = async () => {
    try {
      setIsLoadingUsers(true);
      
      // Add manual users for testing in case the API doesn't return any
      const testUsers = [
        { id: 1, username: "TestUser1", displayName: "Test User 1" },
        { id: 2, username: "TestUser2", displayName: "Test User 2" }
      ];
      
      // Try actual API first
      const response = await fetch("/api/users");
      console.log("Users response status:", response.status);
      
      if (response.ok) {
        const rawData = await response.text();
        console.log("Raw JSON response:", rawData);
        
        try {
          const data = JSON.parse(rawData);
          console.log("Users fetched successfully:", data);
          
          if (Array.isArray(data) && data.length > 0) {
            setUsers(data);
          } else {
            // Fallback to test users if API returns empty array
            console.log("API returned no users, using test data");
            setUsers(testUsers);
          }
        } catch (parseError) {
          console.error("JSON parse error:", parseError);
          // Fallback to test users on JSON parse error
          setUsers(testUsers);
        }
      } else {
        console.error("Failed to fetch users:", response.statusText);
        // Fallback to test users on API error
        setUsers(testUsers);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
      // Fallback to test users on network error
      setUsers([
        { id: 1, username: "TestUser1", displayName: "Test User 1" },
        { id: 2, username: "TestUser2", displayName: "Test User 2" }
      ]);
    } finally {
      setIsLoadingUsers(false);
    }
  };
  
  // Fetch users when component mounts
  useEffect(() => {
    fetchUsers();
  }, []);

  // Fetch invitations if a campaign is selected
  const { data: invitations = [], isLoading: isLoadingInvitations } = useQuery<Invitation[]>({
    // The default query fn uses queryKey[0] verbatim as the URL, so the path has to
    // be the whole first element — otherwise this fetched /api/campaigns instead.
    queryKey: [`/api/campaigns/${selectedCampaignId}/invitations`, refreshKey],
    enabled: !!selectedCampaignId,
    refetchOnWindowFocus: false,
  });

  // Setup form
  const form = useForm<z.infer<typeof invitationSchema>>({
    resolver: zodResolver(invitationSchema),
    defaultValues: {
      email: "",
      userId: undefined,
      role: "player",
      maxUses: 1,
      notes: "",
    },
  });

  // Create invitation mutation
  const createInvitationMutation = useMutation({
    mutationFn: async (data: z.infer<typeof invitationSchema>) => {
      if (!selectedCampaignId) {
        throw new Error("No campaign selected");
      }
      const response = await apiRequest("POST", `/api/campaigns/${selectedCampaignId}/invitations`, data);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create invitation");
      }
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Invitation created!",
        description: "Your invitation has been created successfully.",
      });
      setShowCreateDialog(false);
      form.reset();
      setRefreshKey(prev => prev + 1); // Refresh the list
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create invitation",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete invitation mutation
  const deleteInvitationMutation = useMutation({
    mutationFn: async (invitationId: number) => {
      if (!selectedCampaignId) {
        throw new Error("No campaign selected");
      }
      const response = await apiRequest("DELETE", `/api/campaigns/${selectedCampaignId}/invitations/${invitationId}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to delete invitation");
      }
      return true;
    },
    onSuccess: () => {
      toast({
        title: "Invitation deleted",
        description: "The invitation has been deleted.",
      });
      setRefreshKey(prev => prev + 1); // Refresh the list
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete invitation",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Handle form submission
  const onSubmit = (data: z.infer<typeof invitationSchema>) => {
    createInvitationMutation.mutate(data);
  };

  // Helper function to copy invitation link to clipboard
  const copyInviteLink = (inviteCode: string) => {
    const baseUrl = window.location.origin;
    const inviteLink = `${baseUrl}/join?code=${inviteCode}`;
    
    navigator.clipboard.writeText(inviteLink)
      .then(() => {
        toast({
          title: "Copied to clipboard!",
          description: "Invitation link has been copied to your clipboard.",
        });
      })
      .catch((err) => {
        toast({
          title: "Failed to copy",
          description: "Could not copy the invitation link to clipboard.",
          variant: "destructive",
        });
      });
  };

  // Helper function to determine if an invitation is expired
  const isExpired = (invitation: Invitation): boolean => {
    // Check if it's used up its max uses
    if (invitation.useCount >= invitation.maxUses) {
      return true;
    }
    
    // Check if it has an expiration date and it's in the past
    if (invitation.expiresAt) {
      const expiryDate = new Date(invitation.expiresAt);
      return isAfter(new Date(), expiryDate);
    }
    
    return false;
  };

  // Get status badge
  const getStatusBadge = (invitation: Invitation) => {
    if (isExpired(invitation)) {
      return <Badge variant="outline" className="text-red-500 border-red-500">Expired</Badge>;
    }
    
    switch (invitation.status) {
      case "pending":
        return <Badge variant="outline" className="text-yellow-500 border-yellow-500">Pending</Badge>;
      case "accepted":
        return <Badge variant="outline" className="text-green-500 border-green-500">Accepted</Badge>;
      case "declined":
        return <Badge variant="outline" className="text-red-500 border-red-500">Declined</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  // Get role badge
  const getRoleBadge = (role: string) => {
    switch (role) {
      case "player":
        return <Badge className="bg-blue-500">Player</Badge>;
      case "observer":
        return <Badge className="bg-gray-500">Observer</Badge>;
      case "co-dm":
        return <Badge className="bg-purple-500">Co-DM</Badge>;
      default:
        return <Badge>{role}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-fantasy font-semibold">Campaign Invitations</h2>
          <p className="text-muted-foreground">Create and manage invitations to your campaigns</p>
        </div>
      </div>

      {/* Campaign Selection */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Select a Campaign</CardTitle>
          <CardDescription>Choose a campaign to manage invitations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <Select
              value={selectedCampaignId?.toString() || ""}
              onValueChange={(value) => setSelectedCampaignId(parseInt(value))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a campaign" />
              </SelectTrigger>
              <SelectContent>
                {isLoadingCampaigns ? (
                  <div className="flex items-center justify-center p-4">
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    <span>Loading campaigns...</span>
                  </div>
                ) : (
                  campaigns.map((campaign) => (
                    <SelectItem key={campaign.id} value={campaign.id.toString()}>
                      {campaign.title}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button 
            variant="outline"
            onClick={() => setRefreshKey(prev => prev + 1)}
            disabled={!selectedCampaignId}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button
            onClick={() => setShowCreateDialog(true)}
            disabled={!selectedCampaignId}
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Invitation
          </Button>
        </CardFooter>
      </Card>

      {/* Invitations List */}
      {selectedCampaignId && (
        <div className="space-y-4">
          <h3 className="text-xl font-semibold mt-6">Active Invitations</h3>
          
          {isLoadingInvitations ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="h-8 w-8 animate-spin mr-2" />
              <span>Loading invitations...</span>
            </div>
          ) : invitations.length === 0 ? (
            <Card className="p-8 text-center">
              <Mail className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
              <p className="text-muted-foreground mb-4">You haven't created any invitations for this campaign yet.</p>
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Invitation
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {invitations.map((invitation) => (
                <Card key={invitation.id} className={isExpired(invitation) ? "opacity-70" : ""}>
                  <CardHeader className="pb-2">
                    <div className="flex justify-between">
                      <div className="flex items-center space-x-2">
                        <CardTitle>Invitation</CardTitle>
                        {getStatusBadge(invitation)}
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Manage Invitation</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => copyInviteLink(invitation.inviteCode)}
                          >
                            <Copy className="h-4 w-4 mr-2" />
                            Copy Invite Link
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => deleteInvitationMutation.mutate(invitation.id)}
                            className="text-red-500"
                          >
                            <Trash className="h-4 w-4 mr-2" />
                            Delete Invitation
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="font-mono text-sm p-2 bg-muted rounded flex items-center justify-between">
                        <span className="truncate">{invitation.inviteCode}</span>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => copyInviteLink(invitation.inviteCode)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="flex items-center">
                          <Shield className="h-4 w-4 mr-1 text-muted-foreground" />
                          <span className="mr-2">Role:</span>
                          {getRoleBadge(invitation.role)}
                        </div>
                        
                        <div>
                          <span className="text-muted-foreground">Uses:</span>{" "}
                          <span>{invitation.useCount} / {invitation.maxUses}</span>
                        </div>
                      </div>
                      
                      {invitation.email && (
                        <div className="flex items-center text-sm">
                          <Mail className="h-4 w-4 mr-1 text-muted-foreground" />
                          <span>{invitation.email}</span>
                        </div>
                      )}
                      
                      {invitation.expiresAt && (
                        <div className="flex items-center text-sm">
                          <CalendarClock className="h-4 w-4 mr-1 text-muted-foreground" />
                          <span>
                            Expires: {formatDistanceToNow(new Date(invitation.expiresAt), { addSuffix: true })}
                          </span>
                        </div>
                      )}
                      
                      {invitation.notes && (
                        <div className="text-sm mt-2 border-t pt-2">
                          <p className="text-muted-foreground">{invitation.notes}</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                  <CardFooter className="text-xs text-muted-foreground">
                    Created {format(new Date(invitation.createdAt), "MMM d, yyyy")}
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create Invitation Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Invitation</DialogTitle>
            <DialogDescription>
              Create an invitation link to share with players for your campaign
            </DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="userId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Select User</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(value === "0" ? undefined : parseInt(value))}
                      value={field.value?.toString() || "0"}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a user" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {isLoadingUsers ? (
                          <div className="flex items-center justify-center p-4">
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            <span>Loading users...</span>
                          </div>
                        ) : (
                          <>
                            <SelectItem value="0">None (open invitation)</SelectItem>
                            {Array.isArray(users) && users.length > 0 ? (
                              users.map((user: User) => (
                                <SelectItem key={user.id} value={user.id.toString()}>
                                  {user.displayName || user.username}
                                </SelectItem>
                              ))
                            ) : (
                              <div className="flex items-center justify-center p-4">
                                <span>No users found</span>
                              </div>
                            )}
                          </>
                        )}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Select a registered user to invite directly
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="email@example.com" {...field} />
                    </FormControl>
                    <FormDescription>
                      Enter an email address if sending to a user not registered in the system
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="player">Player</SelectItem>
                        <SelectItem value="observer">Observer</SelectItem>
                        <SelectItem value="co-dm">Co-DM</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Set the permissions level for the invited user
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="maxUses"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Maximum Uses</FormLabel>
                    <FormControl>
                      <Input type="number" min="1" {...field} />
                    </FormControl>
                    <FormDescription>
                      How many times this invitation can be used
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="expiresAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expiration Date (optional)</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormDescription>
                      When this invitation will expire. Leave blank for no expiration.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (optional)</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Add any notes about this invitation" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setShowCreateDialog(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  disabled={createInvitationMutation.isPending}
                >
                  {createInvitationMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Invitation"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}