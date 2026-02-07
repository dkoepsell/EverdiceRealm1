import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Flame,
  ClipboardList,
  MessageSquare,
  Users,
  Scroll,
  Wine,
  Footprints,
  PenTool,
  Dice6,
  CandlestickChart,
  Swords,
  Map,
  LogOut,
  Loader2,
  Plus,
  Sparkles,
  ArrowRight,
  X,
  Crown,
  Trophy,
  Newspaper,
  Star,
  Shield
} from "lucide-react";
import hearthBackground from "@assets/image_1769304828468.png";

interface HearthSnapshot {
  location: {
    name: string;
    murmur: string;
  };
  me: {
    userId: number;
    seatZone: string;
    quietMode: boolean;
    arrivalLine: string;
    returnStreak: number;
  };
  presence: Array<{
    userId: number;
    displayName: string;
    seatZone: string;
    statusText: string;
  }>;
  board: {
    pinned: Array<any>;
    recent: Array<any>;
  };
  events: Array<{
    id: number;
    type: string;
    displayName: string;
    payload: any;
    createdAt: string;
    text: string;
  }>;
}

interface RealmNewsData {
  edition: string;
  news: Array<{
    id: string;
    type: 'achievement' | 'completion' | 'critical' | 'narrative' | 'milestone';
    headline: string;
    body: string;
    characterName: string;
    characterPortrait: string | null;
    characterRace?: string;
    characterClass?: string;
    timestamp: string;
  }>;
  champions: Array<{
    id: number;
    name: string;
    race: string;
    class: string;
    level: number;
    portraitUrl: string | null;
    xp: number;
  }>;
  newArrivals: Array<{
    id: number;
    name: string;
    race: string;
    class: string;
    level: number;
    portraitUrl: string | null;
    createdAt: string;
  }>;
}

const newsTypeIcons: Record<string, string> = {
  achievement: "scroll",
  completion: "trophy",
  critical: "dice",
  narrative: "quill",
  milestone: "star"
};

const seatZones = [
  { value: "fire", label: "By the Fire", icon: Flame },
  { value: "board", label: "At the Board", icon: ClipboardList },
  { value: "window", label: "By the Window", icon: Map },
  { value: "table", label: "At a Table", icon: Users }
];

const marks = [
  { value: "d6", label: "A Die", icon: "🎲" },
  { value: "candle", label: "A Candle", icon: "🕯️" },
  { value: "bootprint", label: "A Bootprint", icon: "👢" },
  { value: "tankard", label: "A Tankard", icon: "🍺" },
  { value: "quill", label: "A Quill", icon: "🪶" }
];

const categoryLabels: Record<string, string> = {
  message: "Message",
  hook: "Hook",
  lfg: "Looking for Group",
  dm_call: "DM Call",
  gift: "Gift"
};

const categoryColors: Record<string, string> = {
  message: "bg-gray-600",
  hook: "bg-amber-600",
  lfg: "bg-green-600",
  dm_call: "bg-purple-600",
  gift: "bg-pink-600"
};

export default function HearthPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [location] = useLocation();
  const [showArrival, setShowArrival] = useState(true);
  const [showGuestWelcome, setShowGuestWelcome] = useState(false);
  
  // Check for guest welcome parameter
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('welcome') === 'guest') {
        setShowGuestWelcome(true);
        // Clean up URL
        window.history.replaceState({}, '', '/hearth');
      }
    }
  }, [location]);
  const [quietMode, setQuietMode] = useState(false);
  const [boardFilter, setBoardFilter] = useState<string>("all");
  const [showPostDialog, setShowPostDialog] = useState(false);
  const [showToastDialog, setShowToastDialog] = useState(false);
  const [newPost, setNewPost] = useState({ category: "message", title: "", body: "" });
  const [toastText, setToastText] = useState("");

  const { data: snapshot, isLoading, refetch } = useQuery<HearthSnapshot>({
    queryKey: ["/api/hearth/snapshot"],
    refetchInterval: 30000
  });

  const { data: realmNews } = useQuery<RealmNewsData>({
    queryKey: ["/api/hearth/realm-news"],
    refetchInterval: 300000
  });

  useEffect(() => {
    if (snapshot?.me?.quietMode) {
      setQuietMode(snapshot.me.quietMode);
    }
    const timer = setTimeout(() => setShowArrival(false), 5000);
    return () => clearTimeout(timer);
  }, [snapshot]);

  const presencePing = useMutation({
    mutationFn: async (data: { seatZone: string; statusText?: string }) => {
      const res = await apiRequest("POST", "/api/hearth/presence/ping", data);
      return res.json();
    }
  });

  useEffect(() => {
    if (!user) return;
    const zone = snapshot?.me?.seatZone || "fire";
    presencePing.mutate({ seatZone: zone });
    const interval = setInterval(() => {
      presencePing.mutate({ seatZone: zone });
    }, 45000);
    return () => clearInterval(interval);
  }, [user, snapshot?.me?.seatZone]);

  const setSeatMutation = useMutation({
    mutationFn: async (seatZone: string) => {
      const res = await apiRequest("POST", "/api/hearth/seat", { seatZone });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hearth/snapshot"] });
    }
  });

  const postToBoardMutation = useMutation({
    mutationFn: async (data: { category: string; title: string; body?: string }) => {
      const res = await apiRequest("POST", "/api/hearth/board", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hearth/snapshot"] });
      setShowPostDialog(false);
      setNewPost({ category: "message", title: "", body: "" });
      toast({ title: "Note posted to the board" });
    }
  });

  const raiseToastMutation = useMutation({
    mutationFn: async (text: string) => {
      const res = await apiRequest("POST", "/api/hearth/toast", { text });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hearth/snapshot"] });
      setShowToastDialog(false);
      setToastText("");
      toast({ title: "Toast raised!" });
    }
  });

  const leaveMarkMutation = useMutation({
    mutationFn: async (mark: string) => {
      const res = await apiRequest("POST", "/api/hearth/mark", { mark });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hearth/snapshot"] });
      toast({ title: "Mark left behind" });
    }
  });

  const departMutation = useMutation({
    mutationFn: async (note?: string) => {
      const res = await apiRequest("POST", "/api/hearth/departure", { note });
      return res.json();
    }
  });

  const deletePostMutation = useMutation({
    mutationFn: async (postId: number) => {
      const res = await apiRequest("DELETE", `/api/hearth/board/${postId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hearth/snapshot"] });
      toast({ title: "Note removed from board" });
    }
  });

  if (isLoading) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center"
        style={{
          backgroundImage: `url(${hearthBackground})`,
          backgroundSize: "cover",
          backgroundPosition: "center"
        }}
      >
        <Card className="bg-black/60 backdrop-blur border-amber-900/50">
          <CardContent className="flex items-center gap-3 py-6">
            <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
            <span className="text-amber-200">Entering the Lantern Hall...</span>
          </CardContent>
        </Card>
      </div>
    );
  }

  const allPosts = [...(snapshot?.board?.pinned || []), ...(snapshot?.board?.recent || [])];
  const filteredPosts = boardFilter === "all" 
    ? allPosts 
    : allPosts.filter(p => p.category === boardFilter);

  return (
    <div 
      className="min-h-screen relative"
      style={{
        backgroundImage: `url(${hearthBackground})`,
        backgroundSize: "cover",
        backgroundPosition: "top center",
        backgroundAttachment: "fixed"
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/60" />
      
      {showArrival && snapshot?.me?.arrivalLine && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
          <Card className="bg-amber-950/90 backdrop-blur border-amber-700/50 max-w-md">
            <CardContent className="py-4 text-center">
              <p className="text-amber-200 italic text-lg">{snapshot.me.arrivalLine}</p>
            </CardContent>
          </Card>
        </div>
      )}
      
      {/* Guest Welcome Banner */}
      {showGuestWelcome && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="bg-gradient-to-b from-amber-950 to-amber-900 border-amber-700 max-w-lg w-full">
            <CardContent className="py-8 text-center space-y-6">
              <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                <Sparkles className="h-8 w-8 text-white" />
              </div>
              
              <div>
                <h2 className="text-2xl font-bold text-amber-200 mb-2">Welcome to the Hearth!</h2>
                <p className="text-amber-300/80">
                  You just completed your first D&D adventure! This is the Hearth — 
                  a cozy community hub where adventurers gather.
                </p>
              </div>
              
              <div className="bg-amber-950/50 rounded-lg p-4 text-left">
                <h3 className="font-bold text-amber-200 mb-2">To continue your journey:</h3>
                <ul className="text-sm text-amber-300/80 space-y-1">
                  <li>• Create a free account to save your progress</li>
                  <li>• Build characters with full D&D 5e stats</li>
                  <li>• Play full campaigns with dynamic storytelling</li>
                  <li>• Join or host multiplayer adventures with friends</li>
                </ul>
              </div>
              
              <div className="flex flex-col gap-3">
                <Link href="/auth">
                  <Button className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white py-6">
                    Create Free Account
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  onClick={() => setShowGuestWelcome(false)}
                  className="text-amber-400 hover:text-amber-300"
                >
                  Look around first
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      
      <div className="relative z-10 container mx-auto p-4 grid grid-cols-1 lg:grid-cols-12 gap-4 pt-8">
        
        {/* World Murmur - floating at top */}
        <div className="lg:col-span-12 flex justify-center">
          <div className="bg-black/50 backdrop-blur-sm px-6 py-2 rounded-full border border-amber-900/30">
            <p className="text-amber-300/80 italic text-sm">{snapshot?.location?.murmur}</p>
          </div>
        </div>
        
        {/* Left Column - Noticeboard */}
        <div className="lg:col-span-4 space-y-4">
          <Card className="bg-amber-950/80 backdrop-blur border-amber-800/50">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-amber-200">
                  <ClipboardList className="w-5 h-5" />
                  The Noticeboard
                </CardTitle>
                <Dialog open={showPostDialog} onOpenChange={setShowPostDialog}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline" className="border-amber-700 text-amber-200 hover:bg-amber-900/50">
                      <Plus className="w-4 h-4 mr-1" /> Post
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-amber-950 border-amber-800">
                    <DialogHeader>
                      <DialogTitle className="text-amber-200">Post to the Board</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <Select value={newPost.category} onValueChange={(v) => setNewPost(p => ({ ...p, category: v }))}>
                        <SelectTrigger className="bg-amber-900/50 border-amber-700">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="message">Message</SelectItem>
                          <SelectItem value="hook">Adventure Hook</SelectItem>
                          <SelectItem value="lfg">Looking for Group</SelectItem>
                          <SelectItem value="dm_call">DM Call</SelectItem>
                          <SelectItem value="gift">Gift</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        placeholder="Title (required)"
                        value={newPost.title}
                        onChange={(e) => setNewPost(p => ({ ...p, title: e.target.value }))}
                        className="bg-amber-900/50 border-amber-700"
                        maxLength={80}
                      />
                      <Textarea
                        placeholder="Details (optional)"
                        value={newPost.body}
                        onChange={(e) => setNewPost(p => ({ ...p, body: e.target.value }))}
                        className="bg-amber-900/50 border-amber-700"
                        maxLength={500}
                      />
                      <Button
                        onClick={() => postToBoardMutation.mutate(newPost)}
                        disabled={!newPost.title.trim() || postToBoardMutation.isPending}
                        className="w-full bg-amber-700 hover:bg-amber-600"
                      >
                        {postToBoardMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Pin to Board"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1 mb-3">
                {["all", "hook", "lfg", "dm_call", "gift"].map(cat => (
                  <Badge
                    key={cat}
                    variant={boardFilter === cat ? "default" : "outline"}
                    className={`cursor-pointer text-xs ${boardFilter === cat ? "bg-amber-700" : "border-amber-700/50 text-amber-300"}`}
                    onClick={() => setBoardFilter(cat)}
                  >
                    {cat === "all" ? "All" : categoryLabels[cat]}
                  </Badge>
                ))}
              </div>
              
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {filteredPosts.length === 0 ? (
                  <p className="text-amber-400/60 text-sm italic text-center py-4">
                    No notes right now. The board is clean, for once.
                  </p>
                ) : (
                  filteredPosts.map(post => (
                    <div key={post.id} className="p-2 bg-amber-900/30 rounded border border-amber-800/30">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge className={`${categoryColors[post.category]} text-xs`}>
                              {categoryLabels[post.category]}
                            </Badge>
                          </div>
                          <p className="text-amber-100 text-sm font-medium">{post.title}</p>
                          {post.body && (
                            <p className="text-amber-300/70 text-xs mt-1">{post.body}</p>
                          )}
                          <p className="text-amber-500/50 text-xs mt-1">— {post.displayName}</p>
                        </div>
                        {post.userId === snapshot?.me?.userId && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-amber-500/50 hover:text-red-400 h-6 w-6 p-0"
                            onClick={() => deletePostMutation.mutate(post.id)}
                          >
                            ×
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
          
          {/* Hearth Memories */}
          <Card className="bg-amber-950/80 backdrop-blur border-amber-800/50">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-amber-200 text-base">
                <Scroll className="w-4 h-4" />
                Hearth Memories
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {(snapshot?.events || []).slice(0, 8).map(event => (
                  <p key={event.id} className="text-amber-300/70 text-xs leading-relaxed">
                    {event.text}
                  </p>
                ))}
                {(!snapshot?.events || snapshot.events.length === 0) && (
                  <p className="text-amber-400/50 text-xs italic">
                    The Hall remembers in silence tonight.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Center - Main Actions */}
        <div className="lg:col-span-4 flex flex-col items-center space-y-4 pt-8">
          {/* Main CTA */}
          <Card className="bg-black/70 backdrop-blur border-amber-700/50 w-full max-w-sm">
            <CardContent className="pt-6 space-y-4">
              <Link href="/play">
                <Button className="w-full bg-gradient-to-r from-amber-700 to-amber-600 hover:from-amber-600 hover:to-amber-500 text-lg py-6">
                  <Swords className="w-5 h-5 mr-2" />
                  Continue Your Adventure
                </Button>
              </Link>
              <div className="grid grid-cols-2 gap-2">
                <Link href="/campaigns">
                  <Button variant="outline" className="w-full border-amber-700/50 text-amber-200 hover:bg-amber-900/30">
                    <Map className="w-4 h-4 mr-1" /> Campaigns
                  </Button>
                </Link>
                <Link href="/characters">
                  <Button variant="outline" className="w-full border-amber-700/50 text-amber-200 hover:bg-amber-900/30">
                    <Users className="w-4 h-4 mr-1" /> Characters
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
          
          {/* Toast & Marks */}
          <Card className="bg-black/60 backdrop-blur border-amber-800/30 w-full max-w-sm">
            <CardContent className="pt-4">
              <p className="text-amber-400/70 text-xs text-center mb-3">Leave your mark</p>
              <div className="flex justify-center gap-2 mb-3">
                {marks.map(mark => (
                  <Button
                    key={mark.value}
                    variant="ghost"
                    size="sm"
                    className="text-xl hover:bg-amber-900/30"
                    onClick={() => leaveMarkMutation.mutate(mark.value)}
                    title={mark.label}
                  >
                    {mark.icon}
                  </Button>
                ))}
              </div>
              <Dialog open={showToastDialog} onOpenChange={setShowToastDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full border-amber-700/50 text-amber-300">
                    <Wine className="w-4 h-4 mr-2" /> Raise a Toast
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-amber-950 border-amber-800">
                  <DialogHeader>
                    <DialogTitle className="text-amber-200">Raise a Toast</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <Input
                      placeholder="To good dice and better friends..."
                      value={toastText}
                      onChange={(e) => setToastText(e.target.value)}
                      className="bg-amber-900/50 border-amber-700"
                      maxLength={120}
                    />
                    <Button
                      onClick={() => raiseToastMutation.mutate(toastText)}
                      disabled={!toastText.trim() || raiseToastMutation.isPending}
                      className="w-full bg-amber-700 hover:bg-amber-600"
                    >
                      {raiseToastMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Raise Toast"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        </div>
        
        {/* Right Column - The Room */}
        <div className="lg:col-span-4">
          <Card className="bg-amber-950/80 backdrop-blur border-amber-800/50">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-amber-200">
                <Flame className="w-5 h-5 text-orange-400" />
                The Room
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Your seat */}
              <div className="mb-4 p-3 bg-amber-900/40 rounded border border-amber-700/30">
                <p className="text-amber-300/70 text-xs mb-2">Your seat:</p>
                <Select 
                  value={snapshot?.me?.seatZone || "fire"} 
                  onValueChange={(v) => setSeatMutation.mutate(v)}
                >
                  <SelectTrigger className="bg-amber-900/50 border-amber-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {seatZones.map(zone => (
                      <SelectItem key={zone.value} value={zone.value}>
                        {zone.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Presence list */}
              <div className="space-y-2 max-h-[350px] overflow-y-auto">
                {(snapshot?.presence || []).length === 0 ? (
                  <p className="text-amber-400/50 text-sm italic text-center py-4">
                    The Hall is quiet. You could be the first to light the mood.
                  </p>
                ) : (
                  snapshot?.presence.map((person, i) => (
                    <div 
                      key={person.userId} 
                      className={`flex items-center gap-3 p-2 rounded ${
                        person.userId === snapshot.me.userId 
                          ? "bg-amber-800/40 border border-amber-600/30" 
                          : "bg-amber-900/20"
                      }`}
                    >
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-700 to-amber-900 flex items-center justify-center text-amber-200 text-sm font-bold">
                        {person.displayName.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-amber-100 text-sm font-medium truncate">
                          {person.displayName}
                          {person.userId === snapshot.me.userId && (
                            <span className="text-amber-500/50 ml-1">(you)</span>
                          )}
                        </p>
                        <p className="text-amber-400/60 text-xs">{person.statusText}</p>
                      </div>
                    </div>
                  ))
                )}
                {(snapshot?.presence || []).length > 0 && (
                  <p className="text-amber-500/40 text-xs text-center pt-2">
                    {snapshot?.presence.length} adventurer{snapshot?.presence.length !== 1 ? 's' : ''} in the Hall
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* News of The Realm */}
          <div className="mt-4 realm-news-parchment rounded-lg overflow-hidden border border-amber-800/60" style={{
            background: 'linear-gradient(168deg, #3d2b1a 0%, #2a1d10 40%, #1f1508 100%)',
            boxShadow: 'inset 0 0 30px rgba(0,0,0,0.4), 0 4px 12px rgba(0,0,0,0.5)'
          }}>
            <div className="px-4 pt-4 pb-2 text-center border-b border-amber-800/40">
              <div className="flex items-center justify-center gap-2 mb-1">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-amber-700/60 to-transparent" />
                <Newspaper className="w-4 h-4 text-amber-500/80" />
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-amber-700/60 to-transparent" />
              </div>
              <h3 className="text-amber-300 font-serif text-lg font-bold tracking-wide" style={{ fontVariant: 'small-caps' }}>
                News of The Realm
              </h3>
              <p className="text-amber-600/70 text-[10px] italic mt-0.5">
                {realmNews?.edition || "Today's Edition"} — Printed by the Town Crier's Guild
              </p>
              <div className="h-px bg-gradient-to-r from-transparent via-amber-700/40 to-transparent mt-2" />
            </div>

            <div className="px-3 py-3 space-y-3">
              {/* News Items */}
              {(realmNews?.news && realmNews.news.length > 0) ? (
                realmNews.news.slice(0, 4).map((item) => (
                  <div key={item.id} className="flex gap-2.5 group">
                    <div className="flex-shrink-0 mt-0.5">
                      {item.characterPortrait ? (
                        <img 
                          src={item.characterPortrait} 
                          alt={item.characterName}
                          className="w-9 h-9 rounded-full object-cover border border-amber-700/50 shadow-sm"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-800 to-amber-950 border border-amber-700/50 flex items-center justify-center shadow-sm">
                          <span className="text-amber-400 text-xs font-bold">
                            {item.characterName.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-amber-200/90 text-xs font-medium leading-snug">
                        {item.headline}
                      </p>
                      <p className="text-amber-500/60 text-[10px] mt-0.5 leading-snug">
                        {item.body}
                      </p>
                    </div>
                    <div className="flex-shrink-0">
                      {item.type === 'critical' && <Dice6 className="w-3.5 h-3.5 text-amber-500/50" />}
                      {item.type === 'completion' && <Trophy className="w-3.5 h-3.5 text-amber-500/50" />}
                      {item.type === 'narrative' && <Scroll className="w-3.5 h-3.5 text-amber-500/50" />}
                      {item.type === 'achievement' && <Star className="w-3.5 h-3.5 text-amber-500/50" />}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-3">
                  <p className="text-amber-500/50 text-xs italic">
                    The realm is quiet... for now. Adventure awaits!
                  </p>
                </div>
              )}
            </div>

            {/* Everdice's Champions */}
            <div className="px-3 pb-3">
              <div className="border-t border-amber-800/40 pt-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <Crown className="w-3.5 h-3.5 text-yellow-500/80" />
                  <h4 className="text-amber-300/90 text-xs font-bold tracking-wider" style={{ fontVariant: 'small-caps' }}>
                    Everdice's Champions
                  </h4>
                </div>
                {(realmNews?.champions && realmNews.champions.length > 0) ? (
                  <div className="space-y-1.5">
                    {realmNews.champions.slice(0, 4).map((champ, idx) => (
                      <div key={champ.id} className="flex items-center gap-2 px-2 py-1 rounded bg-amber-900/20 border border-amber-800/20">
                        {champ.portraitUrl ? (
                          <img 
                            src={champ.portraitUrl} 
                            alt={champ.name}
                            className="w-7 h-7 rounded-full object-cover border border-amber-600/40"
                          />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-yellow-800 to-amber-900 border border-amber-600/40 flex items-center justify-center">
                            <span className="text-yellow-400 text-[10px] font-bold">{champ.name.charAt(0)}</span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-amber-200/90 text-[11px] font-medium truncate">{champ.name}</p>
                          <p className="text-amber-500/50 text-[10px]">Lvl {champ.level} {champ.race} {champ.class}</p>
                        </div>
                        {idx === 0 && <Crown className="w-3 h-3 text-yellow-500/70" />}
                        {idx === 1 && <Shield className="w-3 h-3 text-gray-400/70" />}
                        {idx === 2 && <Shield className="w-3 h-3 text-amber-700/70" />}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-amber-500/50 text-[10px] italic text-center py-2">
                    No champions have risen yet. Will you be the first?
                  </p>
                )}
              </div>
            </div>

            {/* New Arrivals */}
            {realmNews?.newArrivals && realmNews.newArrivals.length > 0 && (
              <div className="px-3 pb-4">
                <div className="border-t border-amber-800/40 pt-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-500/70" />
                    <h4 className="text-amber-300/90 text-xs font-bold tracking-wider" style={{ fontVariant: 'small-caps' }}>
                      New Arrivals
                    </h4>
                  </div>
                  <div className="space-y-1">
                    {realmNews.newArrivals.slice(0, 4).map((arrival) => (
                      <div key={arrival.id} className="flex items-center gap-2 px-2 py-1">
                        {arrival.portraitUrl ? (
                          <img 
                            src={arrival.portraitUrl}
                            alt={arrival.name}
                            className="w-6 h-6 rounded-full object-cover border border-emerald-800/40"
                          />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-900 to-emerald-950 border border-emerald-800/40 flex items-center justify-center">
                            <span className="text-emerald-400 text-[9px] font-bold">{arrival.name.charAt(0)}</span>
                          </div>
                        )}
                        <p className="text-amber-300/70 text-[10px] italic flex-1 min-w-0 truncate">
                          Welcome, <span className="text-amber-200/90 font-medium not-italic">{arrival.name}</span> the {arrival.race} {arrival.class}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="px-4 pb-3">
              <div className="h-px bg-gradient-to-r from-transparent via-amber-700/30 to-transparent" />
              <p className="text-amber-700/40 text-[9px] text-center mt-1.5 italic">
                "All deeds, great and small, are remembered here."
              </p>
            </div>
          </div>
        </div>
      </div>
      
      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translate(-50%, -20px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
        .animate-fade-in {
          animation: fade-in 0.5s ease-out;
        }
      `}</style>
    </div>
  );
}
