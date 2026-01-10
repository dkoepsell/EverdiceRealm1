import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Users, MessageSquare, Plus, Clock, Gamepad2, Search, 
  Calendar, Star, Filter, Trash2, Edit, Send, User
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { BulletinPost, BulletinResponse } from "@shared/schema";

const postTypeLabels: Record<string, string> = {
  lfg: "Looking for Group",
  lfp: "Looking for Players",
  discussion: "Discussion",
  announcement: "Announcement"
};

const experienceLevelLabels: Record<string, string> = {
  beginner: "Beginner-Friendly",
  intermediate: "Intermediate",
  experienced: "Experienced Players",
  any: "All Skill Levels"
};

const playStyleLabels: Record<string, string> = {
  roleplay: "Heavy Roleplay",
  combat: "Combat-Focused",
  exploration: "Exploration",
  mixed: "Balanced Mix"
};

const postTypeBadgeColors: Record<string, string> = {
  lfg: "bg-blue-600 text-white",
  lfp: "bg-purple-600 text-white",
  discussion: "bg-green-600 text-white",
  announcement: "bg-amber-600 text-white"
};

interface PostWithResponses extends BulletinPost {
  responses?: BulletinResponse[];
}

export default function BulletinBoardPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [filter, setFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<PostWithResponses | null>(null);
  const [responseMessage, setResponseMessage] = useState("");

  const [newPost, setNewPost] = useState({
    title: "",
    message: "",
    postType: "lfg",
    gameSystem: "D&D 5e",
    playersNeeded: 1,
    experienceLevel: "any",
    playStyle: "mixed",
    preferredTime: "",
    sessionDuration: "",
    isOngoing: false
  });

  const { data: posts = [], isLoading } = useQuery<BulletinPost[]>({
    queryKey: ["/api/bulletin", filter !== "all" ? `?postType=${filter}` : ""],
  });

  const { data: myPosts = [] } = useQuery<BulletinPost[]>({
    queryKey: ["/api/bulletin/my-posts"],
    enabled: !!user,
  });

  const createPostMutation = useMutation({
    mutationFn: async (post: typeof newPost) => {
      const res = await apiRequest("POST", "/api/bulletin", post);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bulletin"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bulletin/my-posts"] });
      setIsCreateOpen(false);
      setNewPost({
        title: "",
        message: "",
        postType: "lfg",
        gameSystem: "D&D 5e",
        playersNeeded: 1,
        experienceLevel: "any",
        playStyle: "mixed",
        preferredTime: "",
        sessionDuration: "",
        isOngoing: false
      });
      toast({ title: "Post Created", description: "Your post is now live on the bulletin board." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create post.", variant: "destructive" });
    }
  });

  const deletePostMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/bulletin/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bulletin"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bulletin/my-posts"] });
      toast({ title: "Post Deleted" });
    }
  });

  const respondMutation = useMutation({
    mutationFn: async ({ postId, message }: { postId: number; message: string }) => {
      const res = await apiRequest("POST", `/api/bulletin/${postId}/respond`, { message });
      return res.json();
    },
    onSuccess: () => {
      if (selectedPost) {
        queryClient.invalidateQueries({ queryKey: ["/api/bulletin", selectedPost.id] });
        fetchPostDetails(selectedPost.id);
      }
      setResponseMessage("");
      toast({ title: "Response Sent" });
    }
  });

  const fetchPostDetails = async (id: number) => {
    try {
      const res = await fetch(`/api/bulletin/${id}`);
      const data = await res.json();
      setSelectedPost(data);
    } catch (error) {
      console.error("Failed to fetch post details:", error);
    }
  };

  const filteredPosts = posts.filter(post => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return post.title.toLowerCase().includes(query) || 
             post.message.toLowerCase().includes(query);
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-slate-900 via-amber-900/20 to-slate-900 py-8 md:py-12 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-amber-500/10 via-yellow-500/5 to-transparent"></div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl"></div>
        <div className="absolute top-6 right-8 md:right-16 opacity-15">
          <Users className="h-14 w-14 md:h-20 md:w-20 text-amber-400" />
        </div>
        <div className="absolute top-16 right-20 md:right-40 opacity-10">
          <MessageSquare className="h-10 w-10 md:h-16 md:w-16 text-yellow-300" />
        </div>
        <div className="absolute bottom-6 right-12 md:right-28 opacity-10">
          <Gamepad2 className="h-12 w-12 md:h-16 md:w-16 text-amber-300" />
        </div>
        <div className="container mx-auto px-4 relative z-10">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm">
                  <Users className="h-3 w-3" />
                  <span>Find Your Party</span>
                </div>
              </div>
              <h1 className="text-2xl md:text-3xl font-fantasy font-bold text-white mb-2">Bulletin Board</h1>
              <p className="text-white/60">Find players, join games, and connect with fellow adventurers</p>
            </div>
            {user && (
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button className="bg-amber-600 hover:bg-amber-500 text-white" data-testid="button-create-post">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Post
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="text-amber-400">Create a New Post</DialogTitle>
                  <DialogDescription className="text-slate-300">
                    Share what you're looking for with the community
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4 py-4">
                  <div>
                    <Label className="text-slate-200">Post Type</Label>
                    <Select value={newPost.postType} onValueChange={v => setNewPost({...newPost, postType: v})}>
                      <SelectTrigger className="bg-slate-700 border-slate-600 text-white" data-testid="select-post-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-700 border-slate-600">
                        <SelectItem value="lfg">Looking for Group (LFG)</SelectItem>
                        <SelectItem value="lfp">Looking for Players (LFP)</SelectItem>
                        <SelectItem value="discussion">Discussion</SelectItem>
                        <SelectItem value="announcement">Announcement</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-slate-200">Title</Label>
                    <Input
                      value={newPost.title}
                      onChange={e => setNewPost({...newPost, title: e.target.value})}
                      placeholder="Give your post a catchy title"
                      className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400"
                      data-testid="input-post-title"
                    />
                  </div>

                  <div>
                    <Label className="text-slate-200">Message</Label>
                    <Textarea
                      value={newPost.message}
                      onChange={e => setNewPost({...newPost, message: e.target.value})}
                      placeholder="Describe what you're looking for, your experience, availability, etc."
                      className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400 min-h-[120px]"
                      data-testid="input-post-message"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-slate-200">Game System</Label>
                      <Input
                        value={newPost.gameSystem}
                        onChange={e => setNewPost({...newPost, gameSystem: e.target.value})}
                        placeholder="D&D 5e"
                        className="bg-slate-700 border-slate-600 text-white"
                        data-testid="input-game-system"
                      />
                    </div>
                    <div>
                      <Label className="text-slate-200">Players Needed</Label>
                      <Input
                        type="number"
                        min={1}
                        max={10}
                        value={newPost.playersNeeded}
                        onChange={e => setNewPost({...newPost, playersNeeded: parseInt(e.target.value) || 1})}
                        className="bg-slate-700 border-slate-600 text-white"
                        data-testid="input-players-needed"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-slate-200">Experience Level</Label>
                      <Select value={newPost.experienceLevel} onValueChange={v => setNewPost({...newPost, experienceLevel: v})}>
                        <SelectTrigger className="bg-slate-700 border-slate-600 text-white" data-testid="select-experience">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-700 border-slate-600">
                          <SelectItem value="any">All Skill Levels</SelectItem>
                          <SelectItem value="beginner">Beginner-Friendly</SelectItem>
                          <SelectItem value="intermediate">Intermediate</SelectItem>
                          <SelectItem value="experienced">Experienced</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-slate-200">Play Style</Label>
                      <Select value={newPost.playStyle} onValueChange={v => setNewPost({...newPost, playStyle: v})}>
                        <SelectTrigger className="bg-slate-700 border-slate-600 text-white" data-testid="select-playstyle">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-700 border-slate-600">
                          <SelectItem value="mixed">Balanced Mix</SelectItem>
                          <SelectItem value="roleplay">Heavy Roleplay</SelectItem>
                          <SelectItem value="combat">Combat-Focused</SelectItem>
                          <SelectItem value="exploration">Exploration</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-slate-200">Preferred Time</Label>
                      <Input
                        value={newPost.preferredTime}
                        onChange={e => setNewPost({...newPost, preferredTime: e.target.value})}
                        placeholder="e.g., Weekends, Evenings EST"
                        className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400"
                        data-testid="input-preferred-time"
                      />
                    </div>
                    <div>
                      <Label className="text-slate-200">Session Duration</Label>
                      <Input
                        value={newPost.sessionDuration}
                        onChange={e => setNewPost({...newPost, sessionDuration: e.target.value})}
                        placeholder="e.g., 2-3 hours"
                        className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400"
                        data-testid="input-session-duration"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Switch
                      checked={newPost.isOngoing}
                      onCheckedChange={c => setNewPost({...newPost, isOngoing: c})}
                      data-testid="switch-ongoing"
                    />
                    <Label className="text-slate-200">This is for an ongoing campaign (not a one-shot)</Label>
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCreateOpen(false)} className="border-slate-600 text-slate-300">
                    Cancel
                  </Button>
                  <Button 
                    onClick={() => createPostMutation.mutate(newPost)}
                    disabled={!newPost.title || !newPost.message || createPostMutation.isPending}
                    className="bg-amber-600 hover:bg-amber-500"
                    data-testid="button-submit-post"
                  >
                    {createPostMutation.isPending ? "Posting..." : "Post to Bulletin"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto p-6">
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search posts..."
              className="pl-10 bg-slate-800 border-slate-700 text-white placeholder:text-slate-400"
              data-testid="input-search-posts"
            />
          </div>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-[200px] bg-slate-800 border-slate-700 text-white" data-testid="select-filter">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter posts" />
            </SelectTrigger>
            <SelectContent className="bg-slate-700 border-slate-600">
              <SelectItem value="all">All Posts</SelectItem>
              <SelectItem value="lfg">Looking for Group</SelectItem>
              <SelectItem value="lfp">Looking for Players</SelectItem>
              <SelectItem value="discussion">Discussions</SelectItem>
              <SelectItem value="announcement">Announcements</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Tabs defaultValue="browse" className="space-y-6">
          <TabsList className="bg-slate-800 border-slate-700">
            <TabsTrigger value="browse" className="data-[state=active]:bg-amber-600 data-[state=active]:text-white">
              Browse Posts
            </TabsTrigger>
            {user && (
              <TabsTrigger value="my-posts" className="data-[state=active]:bg-amber-600 data-[state=active]:text-white">
                My Posts ({myPosts.length})
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="browse" className="space-y-4">
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <Card key={i} className="bg-slate-800 border-slate-700">
                    <CardContent className="p-6">
                      <Skeleton className="h-6 w-2/3 bg-slate-700 mb-4" />
                      <Skeleton className="h-4 w-full bg-slate-700 mb-2" />
                      <Skeleton className="h-4 w-3/4 bg-slate-700" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : filteredPosts.length === 0 ? (
              <Card className="bg-slate-800 border-slate-700">
                <CardContent className="p-12 text-center">
                  <MessageSquare className="h-12 w-12 text-slate-500 mx-auto mb-4" />
                  <h3 className="text-xl font-medium text-slate-300 mb-2">No posts yet</h3>
                  <p className="text-slate-400 mb-4">Be the first to post on the bulletin board!</p>
                  {user && (
                    <Button onClick={() => setIsCreateOpen(true)} className="bg-amber-600 hover:bg-amber-500">
                      <Plus className="h-4 w-4 mr-2" />
                      Create a Post
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {filteredPosts.map(post => (
                  <Card 
                    key={post.id} 
                    className="bg-slate-800 border-slate-700 hover:border-amber-500/50 transition-colors cursor-pointer"
                    onClick={() => fetchPostDetails(post.id)}
                    data-testid={`card-post-${post.id}`}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge className={postTypeBadgeColors[post.postType || 'lfg']}>
                              {postTypeLabels[post.postType || 'lfg']}
                            </Badge>
                            {post.isOngoing && (
                              <Badge variant="outline" className="border-slate-500 text-slate-300">
                                Ongoing Campaign
                              </Badge>
                            )}
                          </div>
                          <CardTitle className="text-white text-xl">{post.title}</CardTitle>
                        </div>
                        <div className="flex items-center gap-2 text-slate-400 text-sm">
                          <Clock className="h-4 w-4" />
                          {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="text-slate-300 line-clamp-2 mb-4">{post.message}</p>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary" className="bg-slate-700 text-slate-200">
                          <Gamepad2 className="h-3 w-3 mr-1" />
                          {post.gameSystem}
                        </Badge>
                        {(post.playersNeeded ?? 0) > 0 && (
                          <Badge variant="secondary" className="bg-slate-700 text-slate-200">
                            <Users className="h-3 w-3 mr-1" />
                            {post.playersNeeded} player(s) needed
                          </Badge>
                        )}
                        <Badge variant="secondary" className="bg-slate-700 text-slate-200">
                          <Star className="h-3 w-3 mr-1" />
                          {experienceLevelLabels[post.experienceLevel || 'any']}
                        </Badge>
                        {post.preferredTime && (
                          <Badge variant="secondary" className="bg-slate-700 text-slate-200">
                            <Calendar className="h-3 w-3 mr-1" />
                            {post.preferredTime}
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                    <CardFooter className="border-t border-slate-700 pt-3">
                      <div className="flex items-center gap-2 text-slate-400">
                        <MessageSquare className="h-4 w-4" />
                        <span>{post.responseCount || 0} responses</span>
                      </div>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {user && (
            <TabsContent value="my-posts" className="space-y-4">
              {myPosts.length === 0 ? (
                <Card className="bg-slate-800 border-slate-700">
                  <CardContent className="p-12 text-center">
                    <User className="h-12 w-12 text-slate-500 mx-auto mb-4" />
                    <h3 className="text-xl font-medium text-slate-300 mb-2">No posts yet</h3>
                    <p className="text-slate-400 mb-4">Create your first post to find players or groups!</p>
                    <Button onClick={() => setIsCreateOpen(true)} className="bg-amber-600 hover:bg-amber-500">
                      <Plus className="h-4 w-4 mr-2" />
                      Create a Post
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                myPosts.map(post => (
                  <Card key={post.id} className="bg-slate-800 border-slate-700" data-testid={`card-my-post-${post.id}`}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <Badge className={postTypeBadgeColors[post.postType || 'lfg']}>
                            {postTypeLabels[post.postType || 'lfg']}
                          </Badge>
                          <CardTitle className="text-white text-xl mt-2">{post.title}</CardTitle>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deletePostMutation.mutate(post.id)}
                          className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                          data-testid={`button-delete-post-${post.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-slate-300">{post.message}</p>
                    </CardContent>
                    <CardFooter className="border-t border-slate-700 pt-3">
                      <div className="flex items-center gap-4 text-slate-400 text-sm">
                        <span className="flex items-center gap-1">
                          <MessageSquare className="h-4 w-4" />
                          {post.responseCount || 0} responses
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                    </CardFooter>
                  </Card>
                ))
              )}
            </TabsContent>
          )}
        </Tabs>

        <Dialog open={!!selectedPost} onOpenChange={() => setSelectedPost(null)}>
          <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
            {selectedPost && (
              <>
                <DialogHeader>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className={postTypeBadgeColors[selectedPost.postType || 'lfg']}>
                      {postTypeLabels[selectedPost.postType || 'lfg']}
                    </Badge>
                    {selectedPost.isOngoing && (
                      <Badge variant="outline" className="border-slate-500 text-slate-300">
                        Ongoing Campaign
                      </Badge>
                    )}
                  </div>
                  <DialogTitle className="text-2xl text-amber-400">{selectedPost.title}</DialogTitle>
                  <DialogDescription className="text-slate-400">
                    Posted {formatDistanceToNow(new Date(selectedPost.createdAt), { addSuffix: true })}
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  <p className="text-slate-200 whitespace-pre-wrap">{selectedPost.message}</p>

                  <div className="flex flex-wrap gap-2 py-2">
                    <Badge variant="secondary" className="bg-slate-700 text-slate-200">
                      <Gamepad2 className="h-3 w-3 mr-1" />
                      {selectedPost.gameSystem}
                    </Badge>
                    {(selectedPost.playersNeeded ?? 0) > 0 && (
                      <Badge variant="secondary" className="bg-slate-700 text-slate-200">
                        <Users className="h-3 w-3 mr-1" />
                        {selectedPost.playersNeeded} player(s) needed
                      </Badge>
                    )}
                    <Badge variant="secondary" className="bg-slate-700 text-slate-200">
                      {experienceLevelLabels[selectedPost.experienceLevel || 'any']}
                    </Badge>
                    <Badge variant="secondary" className="bg-slate-700 text-slate-200">
                      {playStyleLabels[selectedPost.playStyle || 'mixed']}
                    </Badge>
                    {selectedPost.preferredTime && (
                      <Badge variant="secondary" className="bg-slate-700 text-slate-200">
                        <Calendar className="h-3 w-3 mr-1" />
                        {selectedPost.preferredTime}
                      </Badge>
                    )}
                    {selectedPost.sessionDuration && (
                      <Badge variant="secondary" className="bg-slate-700 text-slate-200">
                        <Clock className="h-3 w-3 mr-1" />
                        {selectedPost.sessionDuration}
                      </Badge>
                    )}
                  </div>

                  <div className="border-t border-slate-700 pt-4">
                    <h4 className="font-medium text-slate-200 mb-3 flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" />
                      Responses ({selectedPost.responses?.length || 0})
                    </h4>

                    {selectedPost.responses && selectedPost.responses.length > 0 ? (
                      <div className="space-y-3 max-h-[200px] overflow-y-auto">
                        {selectedPost.responses.map(response => (
                          <div key={response.id} className="bg-slate-700/50 rounded-lg p-3">
                            <p className="text-slate-200">{response.message}</p>
                            <p className="text-xs text-slate-400 mt-1">
                              {formatDistanceToNow(new Date(response.createdAt), { addSuffix: true })}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-slate-400 text-sm">No responses yet. Be the first to respond!</p>
                    )}

                    {user && (
                      <div className="flex gap-2 mt-4">
                        <Input
                          value={responseMessage}
                          onChange={e => setResponseMessage(e.target.value)}
                          placeholder="Write a response..."
                          className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400"
                          data-testid="input-response"
                        />
                        <Button
                          onClick={() => respondMutation.mutate({ postId: selectedPost.id, message: responseMessage })}
                          disabled={!responseMessage || respondMutation.isPending}
                          className="bg-amber-600 hover:bg-amber-500"
                          data-testid="button-send-response"
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
