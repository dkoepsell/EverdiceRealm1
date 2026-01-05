import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Users, Swords, Shield, Eye, Crown, User, Calendar, MapPin } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Character, Campaign } from "@shared/schema";

interface AdminUser {
  id: number;
  username: string;
  email: string | null;
  displayName: string | null;
  lastLogin: string | null;
  isAdmin: boolean;
  createdAt: string;
  characterCount: number;
  campaignCount: number;
}

export default function AdminPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

  const { data: adminUsers = [], isLoading: usersLoading, error: usersError } = useQuery<AdminUser[]>({
    queryKey: ['/api/admin/users'],
    enabled: !!user?.isAdmin,
  });

  const { data: allCampaigns = [], isLoading: campaignsLoading } = useQuery<Campaign[]>({
    queryKey: ['/api/admin/campaigns'],
    enabled: !!user?.isAdmin,
  });

  const { data: selectedUserCharacters = [], isLoading: charactersLoading } = useQuery<Character[]>({
    queryKey: ['/api/admin/users', selectedUserId, 'characters'],
    enabled: !!selectedUserId && !!user?.isAdmin,
  });

  const toggleAdminMutation = useMutation({
    mutationFn: async (userId: number) => {
      const response = await apiRequest('PATCH', `/api/admin/users/${userId}/toggle-admin`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      toast({ title: "Admin status updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update admin status", description: error.message, variant: "destructive" });
    }
  });

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    setLocation("/auth");
    return null;
  }

  if (!user.isAdmin) {
    return (
      <div className="container mx-auto px-4 py-12">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <Shield className="h-6 w-6" />
              Access Denied
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">You do not have administrator privileges to access this page.</p>
            <Button className="mt-4" onClick={() => setLocation("/")}>Return to Dashboard</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (usersError) {
    return (
      <div className="container mx-auto px-4 py-12">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle className="text-red-600">Error Loading Admin Data</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Failed to load admin data. Please try again.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-fantasy font-bold flex items-center gap-3">
          <Crown className="h-8 w-8 text-gold" />
          God-Mode Admin Panel
        </h1>
        <p className="text-muted-foreground mt-2">Complete overview of all users, characters, and campaigns</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold flex items-center gap-2">
              <Users className="h-6 w-6 text-primary" />
              {adminUsers.length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Characters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold flex items-center gap-2">
              <Swords className="h-6 w-6 text-green-600" />
              {adminUsers.reduce((sum, u) => sum + u.characterCount, 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Campaigns</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold flex items-center gap-2">
              <MapPin className="h-6 w-6 text-amber-600" />
              {allCampaigns.length}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList>
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" /> Users
          </TabsTrigger>
          <TabsTrigger value="campaigns" className="flex items-center gap-2">
            <MapPin className="h-4 w-4" /> Campaigns
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle>All Users</CardTitle>
              <CardDescription>View and manage all registered users and their characters</CardDescription>
            </CardHeader>
            <CardContent>
              {usersLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : (
                <ScrollArea className="h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Characters</TableHead>
                        <TableHead>Campaigns</TableHead>
                        <TableHead>Last Login</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {adminUsers.map((adminUser) => (
                        <TableRow key={adminUser.id} data-testid={`row-user-${adminUser.id}`}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <div className="font-medium">{adminUser.displayName || adminUser.username}</div>
                                <div className="text-xs text-muted-foreground">@{adminUser.username}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">{adminUser.email || '-'}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">{adminUser.characterCount}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{adminUser.campaignCount}</Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {adminUser.lastLogin ? new Date(adminUser.lastLogin).toLocaleDateString() : 'Never'}
                          </TableCell>
                          <TableCell>
                            {adminUser.isAdmin ? (
                              <Badge className="bg-gold text-black">
                                <Crown className="h-3 w-3 mr-1" /> Admin
                              </Badge>
                            ) : (
                              <Badge variant="outline">User</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button 
                                    size="sm" 
                                    variant="outline"
                                    onClick={() => setSelectedUserId(adminUser.id)}
                                    data-testid={`button-view-characters-${adminUser.id}`}
                                  >
                                    <Eye className="h-3 w-3 mr-1" /> Characters
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-2xl">
                                  <DialogHeader>
                                    <DialogTitle>Characters for {adminUser.displayName || adminUser.username}</DialogTitle>
                                  </DialogHeader>
                                  {charactersLoading ? (
                                    <div className="flex justify-center py-8">
                                      <Loader2 className="h-6 w-6 animate-spin" />
                                    </div>
                                  ) : selectedUserCharacters.length === 0 ? (
                                    <p className="text-muted-foreground py-4">No characters created yet.</p>
                                  ) : (
                                    <ScrollArea className="h-[400px]">
                                      <div className="space-y-3">
                                        {selectedUserCharacters.map((char) => (
                                          <Card key={char.id} className="p-4">
                                            <div className="flex items-center justify-between">
                                              <div>
                                                <h4 className="font-semibold">{char.name}</h4>
                                                <p className="text-sm text-muted-foreground">
                                                  Level {char.level} {char.race} {char.class}
                                                </p>
                                              </div>
                                              <div className="text-right text-sm">
                                                <div>HP: {char.currentHp}/{char.maxHp}</div>
                                                <div>XP: {char.experience || 0}</div>
                                              </div>
                                            </div>
                                          </Card>
                                        ))}
                                      </div>
                                    </ScrollArea>
                                  )}
                                </DialogContent>
                              </Dialog>
                              {adminUser.id !== user.id && (
                                <Button
                                  size="sm"
                                  variant={adminUser.isAdmin ? "destructive" : "default"}
                                  onClick={() => toggleAdminMutation.mutate(adminUser.id)}
                                  disabled={toggleAdminMutation.isPending}
                                  data-testid={`button-toggle-admin-${adminUser.id}`}
                                >
                                  {adminUser.isAdmin ? 'Remove Admin' : 'Make Admin'}
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="campaigns">
          <Card>
            <CardHeader>
              <CardTitle>All Campaigns</CardTitle>
              <CardDescription>Overview of all campaigns in the system</CardDescription>
            </CardHeader>
            <CardContent>
              {campaignsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : (
                <ScrollArea className="h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Campaign</TableHead>
                        <TableHead>Owner ID</TableHead>
                        <TableHead>Session</TableHead>
                        <TableHead>Difficulty</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allCampaigns.map((campaign) => (
                        <TableRow key={campaign.id} data-testid={`row-campaign-${campaign.id}`}>
                          <TableCell>
                            <div className="font-medium">{campaign.title}</div>
                            <div className="text-xs text-muted-foreground line-clamp-1">{campaign.description}</div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">User #{campaign.userId}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">Session {campaign.currentSession}</Badge>
                          </TableCell>
                          <TableCell className="text-sm">{campaign.difficulty}</TableCell>
                          <TableCell>
                            {campaign.isCompleted ? (
                              <Badge className="bg-green-600">Completed</Badge>
                            ) : campaign.isArchived ? (
                              <Badge variant="secondary">Archived</Badge>
                            ) : (
                              <Badge className="bg-blue-600">Active</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(campaign.createdAt).toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
