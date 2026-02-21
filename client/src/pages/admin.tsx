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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Loader2, Users, Swords, Shield, Eye, Crown, User, Calendar, MapPin, 
  BarChart3, Activity, TrendingUp, Clock, Dice6, Sparkles, MousePointer 
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Character, Campaign } from "@shared/schema";
import { motion } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts";

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
  totalEvents: number;
  lastActivity: string | null;
}

interface AnalyticsOverview {
  users: { total: number; newThisWeek: number };
  sessions: { today: number; thisWeek: number };
  activity: { eventsToday: number; eventsThisWeek: number };
  diceRolls: { today: number; thisWeek: number };
  campaigns: { active: number; newThisWeek: number };
  characters: { total: number; newThisWeek: number };
}

interface ActivityBreakdown {
  category: string;
  count: number;
}

interface TopFeature {
  feature: string;
  count: number;
}

interface TimelinePoint {
  date: string;
  count: number;
}

interface ActiveUser {
  userId: number;
  eventCount: number;
  lastActive: string;
  username: string;
  displayName: string;
}

interface PageStat {
  page: string;
  views: number;
  avgTimeSpentSeconds: number;
  totalTimeSpentMinutes: number;
  uniqueUsers: number;
}

interface ClickStat {
  elementType: string;
  elementId: string;
  elementText: string;
  clicks: number;
  uniqueUsers: number;
}

interface DetailedEvent {
  eventType: string;
  category: string;
  name: string;
  count: number;
  avgDurationMs: number;
  uniqueUsers: number;
}

interface DemoAnalyticsData {
  overview: {
    started: number;
    completed: number;
    converted: number;
    completionRate: number;
    conversionRate: number;
    completedToConversionRate: number;
  };
  characterBreakdown: { character: string; count: number }[];
  adventureBreakdown: { adventure: string; count: number }[];
  dailyStats: { date: string; started: number; completed: number; converted: number }[];
  funnelStats: { eventType: string; count: number }[];
}

const COLORS = ['#f59e0b', '#ef4444', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

const CHARACTER_NAMES: Record<string, string> = {
  warrior: 'Theron Blackblade (Fighter)',
  wizard: 'Elara Moonwhisper (Wizard)',
  paladin: 'Ser Roland Dawnkeeper (Paladin)',
  rogue: 'Vex Shadowmere (Rogue)'
};

const ADVENTURE_NAMES: Record<string, string> = {
  dungeon: 'The Forgotten Crypts',
  mystery: 'The Merchant\'s Secret'
};

export default function AdminPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [timeRange, setTimeRange] = useState<string>("7");

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

  const { data: analyticsOverview, isLoading: analyticsLoading } = useQuery<AnalyticsOverview>({
    queryKey: ['/api/admin/analytics/overview'],
    enabled: !!user?.isAdmin,
    refetchInterval: 30000,
  });

  const { data: activityBreakdown = [] } = useQuery<ActivityBreakdown[]>({
    queryKey: ['/api/admin/analytics/activity-breakdown', timeRange],
    queryFn: async () => {
      const res = await fetch(`/api/admin/analytics/activity-breakdown?days=${timeRange}`);
      return res.json();
    },
    enabled: !!user?.isAdmin,
  });

  const { data: topFeatures = [] } = useQuery<TopFeature[]>({
    queryKey: ['/api/admin/analytics/top-features', timeRange],
    queryFn: async () => {
      const res = await fetch(`/api/admin/analytics/top-features?days=${timeRange}`);
      return res.json();
    },
    enabled: !!user?.isAdmin,
  });

  const { data: timeline = [] } = useQuery<TimelinePoint[]>({
    queryKey: ['/api/admin/analytics/timeline', timeRange],
    queryFn: async () => {
      const res = await fetch(`/api/admin/analytics/timeline?days=${timeRange}`);
      return res.json();
    },
    enabled: !!user?.isAdmin,
  });

  const { data: activeUsers = [] } = useQuery<ActiveUser[]>({
    queryKey: ['/api/admin/analytics/active-users', timeRange],
    queryFn: async () => {
      const res = await fetch(`/api/admin/analytics/active-users?days=${timeRange}`);
      return res.json();
    },
    enabled: !!user?.isAdmin,
  });

  const { data: pageStats = [] } = useQuery<PageStat[]>({
    queryKey: ['/api/admin/analytics/page-stats', timeRange],
    queryFn: async () => {
      const res = await fetch(`/api/admin/analytics/page-stats?days=${timeRange}`);
      return res.json();
    },
    enabled: !!user?.isAdmin,
  });

  const { data: clickStats = [] } = useQuery<ClickStat[]>({
    queryKey: ['/api/admin/analytics/clicks', timeRange],
    queryFn: async () => {
      const res = await fetch(`/api/admin/analytics/clicks?days=${timeRange}`);
      return res.json();
    },
    enabled: !!user?.isAdmin,
  });

  const { data: detailedEvents = [] } = useQuery<DetailedEvent[]>({
    queryKey: ['/api/admin/analytics/detailed-events', timeRange],
    queryFn: async () => {
      const res = await fetch(`/api/admin/analytics/detailed-events?days=${timeRange}`);
      return res.json();
    },
    enabled: !!user?.isAdmin,
  });

  const { data: demoAnalytics } = useQuery<DemoAnalyticsData>({
    queryKey: ['/api/admin/analytics/demo', timeRange],
    queryFn: async () => {
      const res = await fetch(`/api/admin/analytics/demo?days=${timeRange}`);
      return res.json();
    },
    enabled: !!user?.isAdmin,
    refetchInterval: 60000,
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
        <Card className="max-w-md mx-auto border-red-500/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-500">
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

  const pieData = activityBreakdown.map(item => ({
    name: item.category,
    value: Number(item.count)
  }));

  const formattedTimeline = timeline.map(point => ({
    date: new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    events: Number(point.count)
  }));

  const formattedFeatures = topFeatures.slice(0, 10).map(f => ({
    name: f.feature.length > 20 ? f.feature.slice(0, 20) + '...' : f.feature,
    count: Number(f.count)
  }));

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto px-4 py-8">
        <motion.div 
          className="mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-4xl font-bold flex items-center gap-3 bg-gradient-to-r from-amber-400 via-orange-400 to-red-400 bg-clip-text text-transparent">
            <Crown className="h-10 w-10 text-amber-500" />
            God-Mode Admin Panel
          </h1>
          <p className="text-muted-foreground mt-2">Complete overview of all users, analytics, and system activity</p>
        </motion.div>

        <motion.div 
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="border-primary/20 bg-card/50 backdrop-blur">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Users className="h-3 w-3" /> Total Users
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{analyticsOverview?.users.total || adminUsers.length}</div>
              {analyticsOverview && (
                <p className="text-xs text-emerald-500">+{analyticsOverview.users.newThisWeek} this week</p>
              )}
            </CardContent>
          </Card>
          <Card className="border-primary/20 bg-card/50 backdrop-blur">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Swords className="h-3 w-3" /> Characters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-500">
                {analyticsOverview?.characters.total || adminUsers.reduce((sum, u) => sum + u.characterCount, 0)}
              </div>
              {analyticsOverview && (
                <p className="text-xs text-emerald-500">+{analyticsOverview.characters.newThisWeek} this week</p>
              )}
            </CardContent>
          </Card>
          <Card className="border-primary/20 bg-card/50 backdrop-blur">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3 w-3" /> Campaigns
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-500">{allCampaigns.length}</div>
              {analyticsOverview && (
                <p className="text-xs text-emerald-500">+{analyticsOverview.campaigns.newThisWeek} this week</p>
              )}
            </CardContent>
          </Card>
          <Card className="border-primary/20 bg-card/50 backdrop-blur">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Activity className="h-3 w-3" /> Sessions Today
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-500">{analyticsOverview?.sessions.today || 0}</div>
              <p className="text-xs text-muted-foreground">{analyticsOverview?.sessions.thisWeek || 0} this week</p>
            </CardContent>
          </Card>
          <Card className="border-primary/20 bg-card/50 backdrop-blur">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Dice6 className="h-3 w-3" /> Dice Rolls
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-500">{analyticsOverview?.diceRolls.today || 0}</div>
              <p className="text-xs text-muted-foreground">{analyticsOverview?.diceRolls.thisWeek || 0} this week</p>
            </CardContent>
          </Card>
          <Card className="border-primary/20 bg-card/50 backdrop-blur">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <MousePointer className="h-3 w-3" /> Events Today
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-500">{analyticsOverview?.activity.eventsToday || 0}</div>
              <p className="text-xs text-muted-foreground">{analyticsOverview?.activity.eventsThisWeek || 0} this week</p>
            </CardContent>
          </Card>
        </motion.div>

        <Tabs defaultValue="analytics" className="space-y-4">
          <TabsList className="bg-card/50 backdrop-blur border border-border">
            <TabsTrigger value="analytics" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <BarChart3 className="h-4 w-4" /> Analytics
            </TabsTrigger>
            <TabsTrigger value="demo" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Sparkles className="h-4 w-4" /> Demo & Conversions
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Users className="h-4 w-4" /> Users
            </TabsTrigger>
            <TabsTrigger value="campaigns" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <MapPin className="h-4 w-4" /> Campaigns
            </TabsTrigger>
          </TabsList>

          <TabsContent value="analytics">
            <motion.div 
              className="space-y-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <div className="flex justify-end">
                <Select value={timeRange} onValueChange={setTimeRange}>
                  <SelectTrigger className="w-40 bg-card/50 backdrop-blur">
                    <SelectValue placeholder="Time range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">Last 7 days</SelectItem>
                    <SelectItem value="14">Last 14 days</SelectItem>
                    <SelectItem value="30">Last 30 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="border-primary/20 bg-card/50 backdrop-blur">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-primary" />
                      Activity Over Time
                    </CardTitle>
                    <CardDescription>User interactions per day</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {formattedTimeline.length > 0 ? (
                      <ResponsiveContainer width="100%" height={250}>
                        <LineChart data={formattedTimeline}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: 'hsl(var(--card))', 
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '8px'
                            }} 
                          />
                          <Line 
                            type="monotone" 
                            dataKey="events" 
                            stroke="hsl(var(--primary))" 
                            strokeWidth={2}
                            dot={{ fill: 'hsl(var(--primary))' }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                        <div className="text-center">
                          <Activity className="h-10 w-10 mx-auto mb-2 opacity-50" />
                          <p>No activity data yet</p>
                          <p className="text-sm">User interactions will appear here</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-primary/20 bg-card/50 backdrop-blur">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-amber-500" />
                      Activity by Category
                    </CardTitle>
                    <CardDescription>Breakdown of user actions</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {pieData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={250}>
                        <PieChart>
                          <Pie
                            data={pieData}
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            dataKey="value"
                            label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                            labelLine={false}
                          >
                            {pieData.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                        <div className="text-center">
                          <BarChart3 className="h-10 w-10 mx-auto mb-2 opacity-50" />
                          <p>No category data yet</p>
                          <p className="text-sm">Activity breakdown will appear here</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-primary/20 bg-card/50 backdrop-blur">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <MousePointer className="h-5 w-5 text-blue-500" />
                      Top Features Used
                    </CardTitle>
                    <CardDescription>Most popular actions</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {formattedFeatures.length > 0 ? (
                      <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={formattedFeatures} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                          <YAxis dataKey="name" type="category" stroke="hsl(var(--muted-foreground))" fontSize={10} width={100} />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: 'hsl(var(--card))', 
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '8px'
                            }} 
                          />
                          <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                        <div className="text-center">
                          <MousePointer className="h-10 w-10 mx-auto mb-2 opacity-50" />
                          <p>No feature data yet</p>
                          <p className="text-sm">Feature usage will appear here</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-primary/20 bg-card/50 backdrop-blur">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Users className="h-5 w-5 text-emerald-500" />
                      Most Active Users
                    </CardTitle>
                    <CardDescription>Top engaged players this period</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {activeUsers.length > 0 ? (
                      <div className="space-y-3">
                        {activeUsers.slice(0, 5).map((au, idx) => (
                          <div key={au.userId} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary/20 to-amber-500/20 flex items-center justify-center text-sm font-bold">
                                #{idx + 1}
                              </div>
                              <div>
                                <p className="font-medium">{au.displayName}</p>
                                <p className="text-xs text-muted-foreground">@{au.username}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-primary">{Number(au.eventCount)} events</p>
                              <p className="text-xs text-muted-foreground">
                                Last: {new Date(au.lastActive).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                        <div className="text-center">
                          <Users className="h-10 w-10 mx-auto mb-2 opacity-50" />
                          <p>No active user data yet</p>
                          <p className="text-sm">Active users will appear here</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Page Analytics Section */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                <Card className="border-primary/20 bg-card/50 backdrop-blur">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Eye className="h-5 w-5 text-cyan-500" />
                      Time Spent Per Page
                    </CardTitle>
                    <CardDescription>Average time users spend on each page</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {pageStats.length > 0 ? (
                      <div className="space-y-3 max-h-[300px] overflow-y-auto">
                        {pageStats.slice(0, 10).map((ps, idx) => (
                          <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center text-xs font-mono">
                                {ps.page.substring(0, 3)}
                              </div>
                              <div>
                                <p className="font-medium text-sm">{ps.page || '/'}</p>
                                <p className="text-xs text-muted-foreground">{ps.uniqueUsers} unique users</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-cyan-500">{ps.avgTimeSpentSeconds}s avg</p>
                              <p className="text-xs text-muted-foreground">{ps.views} views</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                        <div className="text-center">
                          <Clock className="h-10 w-10 mx-auto mb-2 opacity-50" />
                          <p>No page timing data yet</p>
                          <p className="text-sm">Page analytics will appear here</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-primary/20 bg-card/50 backdrop-blur">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <MousePointer className="h-5 w-5 text-pink-500" />
                      Click Analytics
                    </CardTitle>
                    <CardDescription>Most clicked elements and interactions</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {clickStats.length > 0 ? (
                      <div className="space-y-3 max-h-[300px] overflow-y-auto">
                        {clickStats.slice(0, 10).map((cs, idx) => (
                          <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-pink-500/20 to-rose-500/20 flex items-center justify-center">
                                <Badge variant="outline" className="text-[10px] px-1">{cs.elementType}</Badge>
                              </div>
                              <div>
                                <p className="font-medium text-sm truncate max-w-[150px]">{cs.elementText || cs.elementId}</p>
                                <p className="text-xs text-muted-foreground truncate max-w-[150px]">{cs.elementId}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-pink-500">{cs.clicks} clicks</p>
                              <p className="text-xs text-muted-foreground">{cs.uniqueUsers} users</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                        <div className="text-center">
                          <MousePointer className="h-10 w-10 mx-auto mb-2 opacity-50" />
                          <p>No click data yet</p>
                          <p className="text-sm">Click analytics will appear here</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Detailed Events Table */}
              <Card className="border-primary/20 bg-card/50 backdrop-blur mt-6">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Activity className="h-5 w-5 text-violet-500" />
                    Detailed Event Breakdown
                  </CardTitle>
                  <CardDescription>Granular view of all tracked events with timing data</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  {detailedEvents.length > 0 ? (
                    <ScrollArea className="h-[350px]">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/30">
                            <TableHead>Event Type</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead className="text-right">Count</TableHead>
                            <TableHead className="text-right">Avg Duration</TableHead>
                            <TableHead className="text-right">Unique Users</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {detailedEvents.map((event, idx) => (
                            <TableRow key={idx} className="hover:bg-muted/20">
                              <TableCell>
                                <Badge variant="outline" className="text-xs">{event.eventType}</Badge>
                              </TableCell>
                              <TableCell className="text-sm">{event.category}</TableCell>
                              <TableCell className="text-sm font-medium">{event.name}</TableCell>
                              <TableCell className="text-right font-semibold text-violet-500">{event.count}</TableCell>
                              <TableCell className="text-right text-muted-foreground">
                                {event.avgDurationMs > 0 ? `${Math.round(event.avgDurationMs / 1000)}s` : '-'}
                              </TableCell>
                              <TableCell className="text-right">{event.uniqueUsers}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  ) : (
                    <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                      <div className="text-center">
                        <Activity className="h-10 w-10 mx-auto mb-2 opacity-50" />
                        <p>No detailed event data yet</p>
                        <p className="text-sm">Granular analytics will appear here</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          <TabsContent value="demo">
            <motion.div 
              className="space-y-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              {/* Demo Overview Cards */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <Card className="border-emerald-500/20 bg-gradient-to-br from-emerald-950/20 to-emerald-900/10 backdrop-blur">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                      <Sparkles className="h-3 w-3" /> Demo Started
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-emerald-400">{demoAnalytics?.overview?.started || 0}</div>
                    <p className="text-xs text-muted-foreground">Total demo sessions</p>
                  </CardContent>
                </Card>
                <Card className="border-blue-500/20 bg-gradient-to-br from-blue-950/20 to-blue-900/10 backdrop-blur">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                      <Activity className="h-3 w-3" /> Completed
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-400">{demoAnalytics?.overview?.completed || 0}</div>
                    <p className="text-xs text-muted-foreground">{demoAnalytics?.overview?.completionRate || 0}% completion</p>
                  </CardContent>
                </Card>
                <Card className="border-amber-500/20 bg-gradient-to-br from-amber-950/20 to-amber-900/10 backdrop-blur">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" /> Converted
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-amber-400">{demoAnalytics?.overview?.converted || 0}</div>
                    <p className="text-xs text-muted-foreground">{demoAnalytics?.overview?.conversionRate || 0}% of all demos</p>
                  </CardContent>
                </Card>
                <Card className="border-purple-500/20 bg-gradient-to-br from-purple-950/20 to-purple-900/10 backdrop-blur">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                      <Crown className="h-3 w-3" /> Completion Rate
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-purple-400">{demoAnalytics?.overview?.completionRate || 0}%</div>
                    <p className="text-xs text-muted-foreground">Finish full demo</p>
                  </CardContent>
                </Card>
                <Card className="border-orange-500/20 bg-gradient-to-br from-orange-950/20 to-orange-900/10 backdrop-blur">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                      <User className="h-3 w-3" /> Signup Rate
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-orange-400">{demoAnalytics?.overview?.conversionRate || 0}%</div>
                    <p className="text-xs text-muted-foreground">Demo to signup</p>
                  </CardContent>
                </Card>
                <Card className="border-rose-500/20 bg-gradient-to-br from-rose-950/20 to-rose-900/10 backdrop-blur">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" /> Completed → Signup
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-rose-400">{demoAnalytics?.overview?.completedToConversionRate || 0}%</div>
                    <p className="text-xs text-muted-foreground">Of completers</p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Conversion Funnel */}
                <Card className="border-primary/20 bg-card/50 backdrop-blur">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-emerald-500" />
                      Conversion Funnel
                    </CardTitle>
                    <CardDescription>Demo progression and drop-off analysis</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {demoAnalytics?.funnelStats && demoAnalytics.funnelStats.length > 0 ? (
                      <div className="space-y-3">
                        {[
                          { key: 'started', label: 'Started Demo', color: 'bg-emerald-500' },
                          { key: 'character_selected', label: 'Selected Character', color: 'bg-teal-500' },
                          { key: 'adventure_selected', label: 'Selected Adventure', color: 'bg-blue-500' },
                          { key: 'scene_completed', label: 'Completed Scene', color: 'bg-indigo-500' },
                          { key: 'completed', label: 'Finished Demo', color: 'bg-purple-500' },
                          { key: 'converted', label: 'Signed Up', color: 'bg-amber-500' },
                        ].map(step => {
                          const stat = demoAnalytics.funnelStats.find(f => f.eventType === step.key);
                          const count = stat?.count || 0;
                          const maxCount = demoAnalytics?.overview?.started || 1;
                          const percentage = maxCount > 0 ? Math.round((count / maxCount) * 100) : 0;
                          
                          return (
                            <div key={step.key} className="space-y-1">
                              <div className="flex justify-between text-sm">
                                <span className="text-slate-300">{step.label}</span>
                                <span className="text-slate-400">{count} ({percentage}%)</span>
                              </div>
                              <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full ${step.color} transition-all duration-500`}
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                        <div className="text-center">
                          <TrendingUp className="h-10 w-10 mx-auto mb-2 opacity-50" />
                          <p>No demo data yet</p>
                          <p className="text-sm">Funnel data will appear here</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Daily Demo Stats Chart */}
                <Card className="border-primary/20 bg-card/50 backdrop-blur">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-blue-500" />
                      Daily Demo Activity
                    </CardTitle>
                    <CardDescription>Demo starts, completions, and conversions per day</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {demoAnalytics?.dailyStats && demoAnalytics.dailyStats.length > 0 ? (
                      <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={demoAnalytics.dailyStats.map(d => ({
                          ...d,
                          date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                        }))}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: 'hsl(var(--card))', 
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '8px'
                            }} 
                          />
                          <Bar dataKey="started" fill="#10b981" name="Started" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="completed" fill="#3b82f6" name="Completed" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="converted" fill="#f59e0b" name="Converted" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                        <div className="text-center">
                          <BarChart3 className="h-10 w-10 mx-auto mb-2 opacity-50" />
                          <p>No daily data yet</p>
                          <p className="text-sm">Daily stats will appear here</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Character Preferences */}
                <Card className="border-primary/20 bg-card/50 backdrop-blur">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Swords className="h-5 w-5 text-red-500" />
                      Popular Characters
                    </CardTitle>
                    <CardDescription>Which characters users choose in demo</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {demoAnalytics?.characterBreakdown && demoAnalytics.characterBreakdown.length > 0 ? (
                      <div className="space-y-3">
                        {demoAnalytics.characterBreakdown.map((char, idx) => {
                          const total = demoAnalytics.characterBreakdown.reduce((sum, c) => sum + c.count, 0);
                          const percentage = total > 0 ? Math.round((char.count / total) * 100) : 0;
                          const displayName = CHARACTER_NAMES[char.character] || char.character;
                          
                          return (
                            <div key={char.character} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
                              <div className="h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold" style={{ backgroundColor: COLORS[idx % COLORS.length] + '30', color: COLORS[idx % COLORS.length] }}>
                                #{idx + 1}
                              </div>
                              <div className="flex-1">
                                <p className="font-medium text-sm">{displayName}</p>
                                <div className="h-1.5 bg-slate-800 rounded-full mt-1 overflow-hidden">
                                  <div 
                                    className="h-full rounded-full"
                                    style={{ width: `${percentage}%`, backgroundColor: COLORS[idx % COLORS.length] }}
                                  />
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="font-semibold">{char.count}</p>
                                <p className="text-xs text-muted-foreground">{percentage}%</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="h-[150px] flex items-center justify-center text-muted-foreground">
                        <div className="text-center">
                          <Swords className="h-10 w-10 mx-auto mb-2 opacity-50" />
                          <p>No character data yet</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Adventure Preferences */}
                <Card className="border-primary/20 bg-card/50 backdrop-blur">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <MapPin className="h-5 w-5 text-purple-500" />
                      Popular Adventures
                    </CardTitle>
                    <CardDescription>Which adventures users choose in demo</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {demoAnalytics?.adventureBreakdown && demoAnalytics.adventureBreakdown.length > 0 ? (
                      <div className="space-y-3">
                        {demoAnalytics.adventureBreakdown.map((adv, idx) => {
                          const total = demoAnalytics.adventureBreakdown.reduce((sum, a) => sum + a.count, 0);
                          const percentage = total > 0 ? Math.round((adv.count / total) * 100) : 0;
                          const displayName = ADVENTURE_NAMES[adv.adventure] || adv.adventure;
                          
                          return (
                            <div key={adv.adventure} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                              <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: COLORS[idx % COLORS.length] + '30' }}>
                                <MapPin className="h-5 w-5" style={{ color: COLORS[idx % COLORS.length] }} />
                              </div>
                              <div className="flex-1">
                                <p className="font-medium">{displayName}</p>
                                <div className="h-2 bg-slate-800 rounded-full mt-1 overflow-hidden">
                                  <div 
                                    className="h-full rounded-full"
                                    style={{ width: `${percentage}%`, backgroundColor: COLORS[idx % COLORS.length] }}
                                  />
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="font-semibold text-lg">{adv.count}</p>
                                <p className="text-xs text-muted-foreground">{percentage}%</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="h-[150px] flex items-center justify-center text-muted-foreground">
                        <div className="text-center">
                          <MapPin className="h-10 w-10 mx-auto mb-2 opacity-50" />
                          <p>No adventure data yet</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </motion.div>
          </TabsContent>

          <TabsContent value="users">
            <Card className="border-primary/20 bg-card/50 backdrop-blur">
              <CardHeader className="bg-gradient-to-r from-primary/5 to-amber-500/5 border-b border-border">
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  All Users
                </CardTitle>
                <CardDescription>View and manage all registered users and their characters</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {usersLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : (
                  <ScrollArea className="h-[500px]">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30">
                          <TableHead>User</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Characters</TableHead>
                          <TableHead>Campaigns</TableHead>
                          <TableHead>Events</TableHead>
                          <TableHead>Last Active</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {adminUsers.map((adminUser) => (
                          <TableRow key={adminUser.id} className="hover:bg-muted/20">
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary/20 to-amber-500/20 flex items-center justify-center">
                                  <User className="h-4 w-4 text-primary" />
                                </div>
                                <div>
                                  <div className="font-medium">{adminUser.displayName || adminUser.username}</div>
                                  <div className="text-xs text-muted-foreground">@{adminUser.username}</div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm">{adminUser.email || '-'}</TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600">
                                {adminUser.characterCount}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{adminUser.campaignCount}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className={adminUser.totalEvents > 0 ? "bg-blue-500/10 text-blue-600" : ""}>
                                {adminUser.totalEvents}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {adminUser.lastActivity 
                                ? new Date(adminUser.lastActivity).toLocaleDateString() + ' ' + new Date(adminUser.lastActivity).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                : adminUser.lastLogin 
                                  ? new Date(adminUser.lastLogin).toLocaleDateString() 
                                  : 'Never'}
                            </TableCell>
                            <TableCell>
                              {adminUser.isAdmin ? (
                                <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white">
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
                                      className="border-primary/30 hover:bg-primary/10"
                                      onClick={() => setSelectedUserId(adminUser.id)}
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
                                            <Card key={char.id} className="p-4 border-primary/20">
                                              <div className="flex items-center justify-between">
                                                <div>
                                                  <h4 className="font-semibold">{char.name}</h4>
                                                  <p className="text-sm text-muted-foreground">
                                                    Level {char.level} {char.race} {char.class}
                                                  </p>
                                                </div>
                                                <div className="text-right text-sm">
                                                  <div>HP: {char.hitPoints}/{char.maxHitPoints}</div>
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
            <Card className="border-primary/20 bg-card/50 backdrop-blur">
              <CardHeader className="bg-gradient-to-r from-primary/5 to-amber-500/5 border-b border-border">
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-amber-500" />
                  All Campaigns
                </CardTitle>
                <CardDescription>Overview of all campaigns in the system</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {campaignsLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : (
                  <ScrollArea className="h-[500px]">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30">
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
                          <TableRow key={campaign.id} className="hover:bg-muted/20">
                            <TableCell>
                              <div className="font-medium">{campaign.title}</div>
                              <div className="text-xs text-muted-foreground line-clamp-1">{campaign.description}</div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">User #{campaign.userId}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">Chapter {campaign.currentSession}</Badge>
                            </TableCell>
                            <TableCell className="text-sm">{campaign.difficulty}</TableCell>
                            <TableCell>
                              {campaign.isCompleted ? (
                                <Badge className="bg-emerald-500 text-white">Completed</Badge>
                              ) : campaign.isArchived ? (
                                <Badge variant="secondary">Archived</Badge>
                              ) : (
                                <Badge className="bg-blue-500 text-white">Active</Badge>
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
    </div>
  );
}
