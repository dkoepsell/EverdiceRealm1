import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient, getQueryFn } from "@/lib/queryClient";
import { Users, Shield, Crown, Swords, Plus, Settings, UserPlus, Mail, Check, X, Trash2, Loader2, MessageSquare, Pin, Send } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { PlayerGroup, GroupInvitation, GroupMessage } from "@shared/schema";
import parchmentFrame from "@assets/image_1768600727955.png";

interface EnrichedInvitation extends GroupInvitation {
  groupName?: string;
  groupType?: string;
  inviterName?: string;
}

interface EnrichedMessage extends GroupMessage {
  authorName: string;
}

const groupTypeIcons: Record<string, any> = {
  party: Users,
  guild: Shield,
  faction: Crown,
  order: Swords,
  brotherhood: Users,
  company: Shield,
};

const groupTypeColors: Record<string, string> = {
  party: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  guild: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  faction: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  order: "bg-green-500/20 text-green-400 border-green-500/30",
  brotherhood: "bg-red-500/20 text-red-400 border-red-500/30",
  company: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
};

export default function GroupsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [inviteGroupId, setInviteGroupId] = useState<number | null>(null);
  const [inviteUsername, setInviteUsername] = useState("");
  const [inviteMessage, setInviteMessage] = useState("");
  const [newGroup, setNewGroup] = useState({
    name: "",
    type: "party",
    description: "",
    motto: "",
  });
  const [settingsGroup, setSettingsGroup] = useState<PlayerGroup | null>(null);
  const [editingGroup, setEditingGroup] = useState({
    name: "",
    description: "",
    motto: "",
    collectiveIdentity: "",
  });
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [messagesBoardGroup, setMessagesBoardGroup] = useState<PlayerGroup | null>(null);
  const [newMessage, setNewMessage] = useState({ title: "", content: "" });

  const { data: groups = [], isLoading } = useQuery<PlayerGroup[]>({
    queryKey: ['/api/groups'],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const { data: pendingInvitations = [] } = useQuery<EnrichedInvitation[]>({
    queryKey: ['/api/invitations/pending'],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !!user,
  });

  const { data: groupMessages = [], isLoading: messagesLoading } = useQuery<EnrichedMessage[]>({
    queryKey: ['/api/groups', messagesBoardGroup?.id, 'messages'],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !!messagesBoardGroup,
  });

  const postMessageMutation = useMutation({
    mutationFn: async ({ groupId, title, content }: { groupId: number; title: string; content: string }) => {
      const response = await apiRequest("POST", `/api/groups/${groupId}/messages`, { title, content });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/groups', messagesBoardGroup?.id, 'messages'] });
      setNewMessage({ title: "", content: "" });
      toast({
        title: "Message Posted",
        description: "Your message has been added to the board!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to post message",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    },
  });

  const deleteMessageMutation = useMutation({
    mutationFn: async ({ groupId, messageId }: { groupId: number; messageId: number }) => {
      const response = await apiRequest("DELETE", `/api/groups/${groupId}/messages/${messageId}`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/groups', messagesBoardGroup?.id, 'messages'] });
      toast({
        title: "Message Deleted",
        description: "The message has been removed.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to delete message",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    },
  });

  const pinMessageMutation = useMutation({
    mutationFn: async ({ groupId, messageId }: { groupId: number; messageId: number }) => {
      const response = await apiRequest("PATCH", `/api/groups/${groupId}/messages/${messageId}/pin`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/groups', messagesBoardGroup?.id, 'messages'] });
      toast({
        title: "Message Updated",
        description: "Pin status has been changed.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update message",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    },
  });

  const createGroupMutation = useMutation({
    mutationFn: async (groupData: typeof newGroup) => {
      const response = await apiRequest("POST", "/api/groups", groupData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/groups'] });
      setIsCreateOpen(false);
      setNewGroup({ name: "", type: "party", description: "", motto: "" });
      toast({
        title: "Group Created",
        description: "Your new group has been founded!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create group",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    },
  });

  const inviteMutation = useMutation({
    mutationFn: async ({ groupId, username, message }: { groupId: number; username: string; message?: string }) => {
      const response = await apiRequest("POST", `/api/groups/${groupId}/invite`, { username, message });
      return response.json();
    },
    onSuccess: () => {
      setInviteGroupId(null);
      setInviteUsername("");
      setInviteMessage("");
      toast({
        title: "Invitation Sent",
        description: "The player has been invited to join your group!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to send invitation",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    },
  });

  const acceptInvitationMutation = useMutation({
    mutationFn: async (invitationId: number) => {
      const response = await apiRequest("POST", `/api/group-invitations/${invitationId}/accept`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/invitations/pending'] });
      queryClient.invalidateQueries({ queryKey: ['/api/groups'] });
      toast({
        title: "Joined Group",
        description: "You have joined the group!",
      });
    },
  });

  const declineInvitationMutation = useMutation({
    mutationFn: async (invitationId: number) => {
      const response = await apiRequest("POST", `/api/group-invitations/${invitationId}/decline`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/invitations/pending'] });
      toast({
        title: "Invitation Declined",
        description: "The invitation has been declined.",
      });
    },
  });

  const updateGroupMutation = useMutation({
    mutationFn: async ({ groupId, updates }: { groupId: number; updates: Partial<typeof editingGroup> }) => {
      const response = await apiRequest("PATCH", `/api/groups/${groupId}`, updates);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/groups'] });
      setSettingsGroup(null);
      toast({
        title: "Group Updated",
        description: "Your group settings have been saved!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update group",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    },
  });

  const deleteGroupMutation = useMutation({
    mutationFn: async (groupId: number) => {
      const response = await apiRequest("DELETE", `/api/groups/${groupId}`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/groups'] });
      setSettingsGroup(null);
      setDeleteConfirmOpen(false);
      toast({
        title: "Group Dissolved",
        description: "Your group has been permanently deleted.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to delete group",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    },
  });

  const openGroupSettings = (group: PlayerGroup) => {
    setSettingsGroup(group);
    setEditingGroup({
      name: group.name || "",
      description: group.description || "",
      motto: group.motto || "",
      collectiveIdentity: group.collectiveIdentity || "",
    });
  };

  const handleUpdateGroup = () => {
    if (!settingsGroup || !editingGroup.name.trim()) {
      toast({
        title: "Name required",
        description: "Please enter a name for your group",
        variant: "destructive",
      });
      return;
    }
    updateGroupMutation.mutate({ 
      groupId: settingsGroup.id, 
      updates: editingGroup 
    });
  };

  const handleCreateGroup = () => {
    if (!newGroup.name.trim()) {
      toast({
        title: "Name required",
        description: "Please enter a name for your group",
        variant: "destructive",
      });
      return;
    }
    createGroupMutation.mutate(newGroup);
  };

  const handleInvite = () => {
    if (!inviteGroupId || !inviteUsername.trim()) return;
    inviteMutation.mutate({ 
      groupId: inviteGroupId, 
      username: inviteUsername.trim(),
      message: inviteMessage.trim() || undefined
    });
  };

  const handlePostMessage = () => {
    if (!messagesBoardGroup || !newMessage.content.trim()) return;
    postMessageMutation.mutate({
      groupId: messagesBoardGroup.id,
      title: newMessage.title.trim() || "Untitled",
      content: newMessage.content.trim(),
    });
  };

  const isGroupLeader = (group: PlayerGroup) => {
    if (!user) return false;
    return group.founderId === user.id || (group.leaderIds?.includes(user.id) ?? false);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <section className="relative overflow-hidden rounded-xl bg-gradient-to-br from-purple-900/40 via-indigo-900/30 to-blue-900/40 border border-purple-500/20 p-8 mb-8">
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
        <div className="absolute top-4 right-8 opacity-10">
          <Shield className="h-20 w-20 text-purple-300" />
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-sm">
              <Users className="h-3 w-3" />
              <span>Community</span>
            </div>
          </div>
          <h1 className="text-3xl font-fantasy font-bold text-white mb-3">
            Parties, Guilds & Factions
          </h1>
          <p className="text-lg text-white/70 mb-6">
            Form adventuring parties, establish guilds, and build your reputation together.
          </p>
          {user && (
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600">
                  <Plus className="mr-2 h-4 w-4" />
                  Found a Group
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Found a New Group</DialogTitle>
                  <DialogDescription>
                    Create an adventuring party, guild, or faction
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Group Name</Label>
                    <Input
                      id="name"
                      placeholder="The Silver Blades..."
                      value={newGroup.name}
                      onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="type">Type</Label>
                    <Select
                      value={newGroup.type}
                      onValueChange={(value) => setNewGroup({ ...newGroup, type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="party">Adventuring Party</SelectItem>
                        <SelectItem value="guild">Guild</SelectItem>
                        <SelectItem value="faction">Faction</SelectItem>
                        <SelectItem value="order">Holy Order</SelectItem>
                        <SelectItem value="brotherhood">Brotherhood</SelectItem>
                        <SelectItem value="company">Mercenary Company</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="motto">Motto (optional)</Label>
                    <Input
                      id="motto"
                      placeholder="Fortune favors the bold..."
                      value={newGroup.motto}
                      onChange={(e) => setNewGroup({ ...newGroup, motto: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description (optional)</Label>
                    <Textarea
                      id="description"
                      placeholder="Tell the story of your group..."
                      value={newGroup.description}
                      onChange={(e) => setNewGroup({ ...newGroup, description: e.target.value })}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateGroup} disabled={createGroupMutation.isPending}>
                    {createGroupMutation.isPending ? "Creating..." : "Found Group"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </section>

      {/* Pending Invitations */}
      {user && pendingInvitations.length > 0 && (
        <Card className="mb-8 border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-orange-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-amber-400" />
              Pending Invitations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingInvitations.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between p-3 border border-border/50 rounded-lg">
                  <div>
                    <p className="font-medium">{inv.groupName}</p>
                    <p className="text-sm text-muted-foreground">
                      Invited by {inv.inviterName} to join this {inv.groupType}
                    </p>
                    {inv.message && (
                      <p className="text-sm italic mt-1">"{inv.message}"</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => acceptInvitationMutation.mutate(inv.id)}
                      disabled={acceptInvitationMutation.isPending}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Accept
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => declineInvitationMutation.mutate(inv.id)}
                      disabled={declineInvitationMutation.isPending}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Invite Player Dialog */}
      <Dialog open={inviteGroupId !== null} onOpenChange={(open) => !open && setInviteGroupId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Player</DialogTitle>
            <DialogDescription>
              Enter the username of the player you want to invite
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                placeholder="Enter player username..."
                value={inviteUsername}
                onChange={(e) => setInviteUsername(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inviteMessage">Message (optional)</Label>
              <Textarea
                id="inviteMessage"
                placeholder="Join our band of adventurers..."
                value={inviteMessage}
                onChange={(e) => setInviteMessage(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteGroupId(null)}>
              Cancel
            </Button>
            <Button 
              onClick={handleInvite} 
              disabled={!inviteUsername.trim() || inviteMutation.isPending}
            >
              {inviteMutation.isPending ? "Sending..." : "Send Invitation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-6 bg-muted rounded w-3/4" />
                <div className="h-4 bg-muted rounded w-1/2 mt-2" />
              </CardHeader>
              <CardContent>
                <div className="h-16 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : groups.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <Users className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h3 className="text-xl font-semibold mb-2">No Groups Yet</h3>
            <p className="text-muted-foreground mb-4">
              Be the first to found a party, guild, or faction!
            </p>
            {user && (
              <Button onClick={() => setIsCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Found a Group
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {groups.map((group) => {
            const Icon = groupTypeIcons[group.type] || Users;
            const colorClass = groupTypeColors[group.type] || "bg-gray-500/20 text-gray-400";
            
            return (
              <Card key={group.id} className="hover:border-primary/50 transition-colors">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${colorClass}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{group.name}</CardTitle>
                        <Badge variant="outline" className="mt-1 capitalize">
                          {group.type}
                        </Badge>
                      </div>
                    </div>
                    {user && group.founderId === user.id && (
                      <Button variant="ghost" size="icon" onClick={() => openGroupSettings(group)}>
                        <Settings className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  {group.motto && (
                    <CardDescription className="italic mt-2">
                      "{group.motto}"
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  {group.description && (
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
                      {group.description}
                    </p>
                  )}
                  {group.collectiveIdentity && (
                    <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 mb-4">
                      <p className="text-sm font-medium text-primary">
                        {group.collectiveIdentity}
                      </p>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Users className="h-4 w-4" />
                      <span>Members</span>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setMessagesBoardGroup(group)}
                      >
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Board
                      </Button>
                      {user && (group.founderId === user.id || group.leaderIds?.includes(user.id)) && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setInviteGroupId(group.id)}
                        >
                          <UserPlus className="h-4 w-4 mr-2" />
                          Invite
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Group Settings Dialog */}
      <Dialog open={!!settingsGroup} onOpenChange={(open) => !open && setSettingsGroup(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Group Settings
            </DialogTitle>
            <DialogDescription>
              Manage your {settingsGroup?.type} settings
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Group Name</Label>
              <Input
                id="edit-name"
                value={editingGroup.name}
                onChange={(e) => setEditingGroup({ ...editingGroup, name: e.target.value })}
                placeholder="Enter group name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-motto">Motto</Label>
              <Input
                id="edit-motto"
                value={editingGroup.motto}
                onChange={(e) => setEditingGroup({ ...editingGroup, motto: e.target.value })}
                placeholder="A short rallying cry or slogan"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={editingGroup.description}
                onChange={(e) => setEditingGroup({ ...editingGroup, description: e.target.value })}
                placeholder="Describe your group's purpose and goals"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-identity">Collective Identity</Label>
              <Input
                id="edit-identity"
                value={editingGroup.collectiveIdentity}
                onChange={(e) => setEditingGroup({ ...editingGroup, collectiveIdentity: e.target.value })}
                placeholder='e.g., "The Defenders of the Realm"'
              />
            </div>
          </div>
          <DialogFooter className="flex flex-col gap-2 sm:flex-row">
            <Button 
              variant="destructive" 
              onClick={() => setDeleteConfirmOpen(true)}
              className="w-full sm:w-auto"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Dissolve Group
            </Button>
            <div className="flex gap-2 ml-auto">
              <Button variant="outline" onClick={() => setSettingsGroup(null)}>
                Cancel
              </Button>
              <Button 
                onClick={handleUpdateGroup}
                disabled={updateGroupMutation.isPending}
              >
                {updateGroupMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                Save Changes
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Dissolve {settingsGroup?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your {settingsGroup?.type} and remove all member associations. 
              All members will lose access to this group.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => settingsGroup && deleteGroupMutation.mutate(settingsGroup.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteGroupMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Dissolve Group
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Message Board Dialog */}
      <Dialog open={!!messagesBoardGroup} onOpenChange={(open) => !open && setMessagesBoardGroup(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              {messagesBoardGroup?.name} - Message Board
            </DialogTitle>
            <DialogDescription>
              Share notes, plans, and updates with your group
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
            {/* New Message Form */}
            <div className="space-y-3 border-b pb-4">
              <Input
                placeholder="Subject (optional)"
                value={newMessage.title}
                onChange={(e) => setNewMessage({ ...newMessage, title: e.target.value })}
              />
              <div className="flex gap-2">
                <Textarea
                  placeholder="Write your message..."
                  value={newMessage.content}
                  onChange={(e) => setNewMessage({ ...newMessage, content: e.target.value })}
                  rows={2}
                  className="flex-1"
                />
                <Button
                  onClick={handlePostMessage}
                  disabled={!newMessage.content.trim() || postMessageMutation.isPending}
                  className="self-end"
                >
                  {postMessageMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            
            {/* Messages List */}
            <ScrollArea className="flex-1 min-h-[200px] max-h-[400px] pr-4">
              {messagesLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="animate-pulse">
                      <div className="h-4 bg-muted rounded w-1/3 mb-2" />
                      <div className="h-16 bg-muted rounded" />
                    </div>
                  ))}
                </div>
              ) : groupMessages.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>No messages yet</p>
                  <p className="text-sm">Be the first to post!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {groupMessages.map((msg) => (
                    <Card key={msg.id} className={msg.isPinned ? "border-amber-500/50 bg-amber-500/5" : ""}>
                      <CardHeader className="py-3 px-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              {msg.isPinned && <Pin className="h-3 w-3 text-amber-500" />}
                              <CardTitle className="text-sm font-medium">
                                {msg.title || "Untitled"}
                              </CardTitle>
                            </div>
                            <CardDescription className="text-xs mt-1">
                              by {msg.authorName} • {new Date(msg.createdAt!).toLocaleDateString()}
                            </CardDescription>
                          </div>
                          <div className="flex gap-1">
                            {messagesBoardGroup && isGroupLeader(messagesBoardGroup) && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => pinMessageMutation.mutate({ groupId: messagesBoardGroup.id, messageId: msg.id })}
                                disabled={pinMessageMutation.isPending}
                              >
                                <Pin className={`h-3 w-3 ${msg.isPinned ? "text-amber-500" : "text-muted-foreground"}`} />
                              </Button>
                            )}
                            {(msg.authorId === user?.id || (messagesBoardGroup && isGroupLeader(messagesBoardGroup))) && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-destructive"
                                onClick={() => messagesBoardGroup && deleteMessageMutation.mutate({ groupId: messagesBoardGroup.id, messageId: msg.id })}
                                disabled={deleteMessageMutation.isPending}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="py-2 px-4">
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
