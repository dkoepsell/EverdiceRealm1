import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { SidebarTabs, SidebarTabsList, SidebarTabsTrigger, TabsContent } from "@/components/ui/sidebar-tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useAnalytics } from "@/hooks/use-analytics";
import { apiRequest, queryClient, getQueryFn } from "@/lib/queryClient";
import {
  Search, Star, Download, Scroll, Gem, Shield, Swords, Wand2,
  Loader2, Plus, Trash2, Filter, TrendingUp, Clock, Users,
  MapPin, BookOpen, Heart, Package, AlertTriangle
} from "lucide-react";
import type { SharedAdventure, SharedItem, TradingPostReview } from "@shared/schema";
import { AdventureCoverArt } from "@/components/adventure/adventure-cover-art";
import parchmentFrame from "@assets/image_1768600727955.png";

interface AdventureWithAuthor extends SharedAdventure {
  authorUsername: string;
}

interface ItemWithAuthor extends SharedItem {
  authorUsername: string;
}

interface ReviewWithUsername extends TradingPostReview {
  username: string;
}

interface AdventureDetail extends SharedAdventure {
  author: { id?: number; username: string; displayName?: string; avatarUrl?: string };
  reviews: ReviewWithUsername[];
}

interface ItemDetail extends SharedItem {
  author: { id?: number; username: string; displayName?: string; avatarUrl?: string };
  reviews: ReviewWithUsername[];
}

const difficultyColors: Record<string, string> = {
  easy: "bg-green-500/20 text-green-400 border-green-500/30",
  medium: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  hard: "bg-red-500/20 text-red-400 border-red-500/30",
  deadly: "bg-purple-500/20 text-purple-400 border-purple-500/30",
};

const rarityColors: Record<string, string> = {
  common: "bg-gray-500/20 text-gray-400",
  uncommon: "bg-green-500/20 text-green-400",
  rare: "bg-blue-500/20 text-blue-400",
  very_rare: "bg-purple-500/20 text-purple-400",
  legendary: "bg-amber-500/20 text-amber-400",
  artifact: "bg-red-500/20 text-red-400",
};

function StarRating({ rating, onRate, interactive = false }: { rating: number; onRate?: (r: number) => void; interactive?: boolean }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`h-4 w-4 ${i <= rating ? "fill-amber-400 text-amber-400" : "text-gray-600"} ${interactive ? "cursor-pointer hover:text-amber-300" : ""}`}
          onClick={() => interactive && onRate?.(i)}
        />
      ))}
    </div>
  );
}

export default function TradingPostPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { trackPageView, trackFeatureUse } = useAnalytics();

  useEffect(() => {
    trackPageView('trading_post');
  }, [trackPageView]);

  const [activeTab, setActiveTab] = useState("adventures");
  const [adventureSearch, setAdventureSearch] = useState("");
  const [adventureDifficulty, setAdventureDifficulty] = useState("all");
  const [adventureGenre, setAdventureGenre] = useState("all");
  const [adventureSort, setAdventureSort] = useState("newest");
  const [itemSearch, setItemSearch] = useState("");
  const [itemType, setItemType] = useState("all");
  const [itemRarity, setItemRarity] = useState("all");
  const [itemSort, setItemSort] = useState("newest");

  const [showPublishAdventure, setShowPublishAdventure] = useState(false);
  const [showPublishItem, setShowPublishItem] = useState(false);
  const [selectedAdventure, setSelectedAdventure] = useState<number | null>(null);
  const [selectedItem, setSelectedItem] = useState<number | null>(null);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");

  const [newAdventure, setNewAdventure] = useState({
    title: "",
    description: "",
    shortDescription: "",
    camlData: "",
    difficulty: "medium",
    genre: "fantasy",
    playerCountMin: 1,
    playerCountMax: 5,
    estimatedSessions: 1,
    tags: "",
    coverImageUrl: "",
  });

  const [shareCharacterId, setShareCharacterId] = useState<number | null>(null);
  const [shareSelectedItem, setShareSelectedItem] = useState<string>("");
  const [shareLore, setShareLore] = useState("");
  const [shareTags, setShareTags] = useState("");

  const [playerMarketSearch, setPlayerMarketSearch] = useState("");
  const [listItemDialogOpen, setListItemDialogOpen] = useState(false);
  const [selectedListCharacter, setSelectedListCharacter] = useState<number | null>(null);
  const [selectedListItem, setSelectedListItem] = useState<string>("");
  const [listAskingPrice, setListAskingPrice] = useState(10);
  const [buyingCharacter, setBuyingCharacter] = useState<number | null>(null);

  const adventureQueryParams = new URLSearchParams();
  if (adventureSearch) adventureQueryParams.set("search", adventureSearch);
  if (adventureDifficulty !== "all") adventureQueryParams.set("difficulty", adventureDifficulty);
  if (adventureGenre !== "all") adventureQueryParams.set("genre", adventureGenre);
  adventureQueryParams.set("sort", adventureSort);
  adventureQueryParams.set("limit", "20");

  const itemQueryParams = new URLSearchParams();
  if (itemSearch) itemQueryParams.set("search", itemSearch);
  if (itemType !== "all") itemQueryParams.set("itemType", itemType);
  if (itemRarity !== "all") itemQueryParams.set("rarity", itemRarity);
  itemQueryParams.set("sort", itemSort);
  itemQueryParams.set("limit", "20");

  const { data: adventuresData, isLoading: adventuresLoading } = useQuery<{ adventures: AdventureWithAuthor[]; page: number; limit: number }>({
    queryKey: ["/api/trading-post/adventures", adventureSearch, adventureDifficulty, adventureGenre, adventureSort],
    queryFn: async () => {
      const res = await fetch(`/api/trading-post/adventures?${adventureQueryParams.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch adventures");
      return res.json();
    },
  });

  const { data: itemsData, isLoading: itemsLoading } = useQuery<{ items: ItemWithAuthor[]; page: number; limit: number }>({
    queryKey: ["/api/trading-post/items", itemSearch, itemType, itemRarity, itemSort],
    queryFn: async () => {
      const res = await fetch(`/api/trading-post/items?${itemQueryParams.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch items");
      return res.json();
    },
  });

  const { data: adventureDetail, isLoading: adventureDetailLoading } = useQuery<AdventureDetail>({
    queryKey: ["/api/trading-post/adventures", selectedAdventure],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: selectedAdventure !== null,
  });

  const { data: itemDetail, isLoading: itemDetailLoading } = useQuery<ItemDetail>({
    queryKey: ["/api/trading-post/items", selectedItem],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: selectedItem !== null,
  });

  const publishAdventureMutation = useMutation({
    mutationFn: async (data: typeof newAdventure) => {
      const payload: any = {
        title: data.title,
        description: data.description,
        shortDescription: data.shortDescription || undefined,
        difficulty: data.difficulty,
        genre: data.genre,
        playerCountMin: data.playerCountMin,
        playerCountMax: data.playerCountMax,
        estimatedSessions: data.estimatedSessions,
        tags: data.tags ? data.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
        coverImageUrl: data.coverImageUrl || undefined,
        status: "published",
        createdAt: new Date().toISOString(),
      };
      if (data.camlData.trim()) {
        try {
          payload.camlData = JSON.parse(data.camlData);
        } catch {
          payload.camlData = data.camlData;
        }
      }
      const response = await apiRequest("POST", "/api/trading-post/adventures", payload);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trading-post/adventures"] });
      setShowPublishAdventure(false);
      setNewAdventure({ title: "", description: "", shortDescription: "", camlData: "", difficulty: "medium", genre: "fantasy", playerCountMin: 1, playerCountMax: 5, estimatedSessions: 1, tags: "", coverImageUrl: "" });
      toast({ title: "Adventure Published!", description: "Your adventure is now available in the Trading Post." });
    },
    onError: (error: any) => {
      toast({ title: "Failed to publish", description: error.message || "Something went wrong", variant: "destructive" });
    },
  });

  const publishItemMutation = useMutation({
    mutationFn: async ({ characterId, itemRaw, lore, tags }: { characterId: number; itemRaw: string; lore: string; tags: string }) => {
      const payload = {
        characterId,
        itemRaw,
        lore: lore || undefined,
        tags: tags ? tags.split(",").map((t: string) => t.trim()).filter(Boolean) : [],
      };
      const response = await apiRequest("POST", "/api/trading-post/items", payload);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trading-post/items"] });
      setShowPublishItem(false);
      setShareCharacterId(null);
      setShareSelectedItem("");
      setShareLore("");
      setShareTags("");
      toast({ title: "Item Shared!", description: "Your item is now available in the Trading Post." });
    },
    onError: (error: any) => {
      toast({ title: "Failed to share", description: error.message || "Something went wrong", variant: "destructive" });
    },
  });

  const downloadAdventureMutation = useMutation({
    mutationFn: async (id: number) => {
      const downloadResponse = await apiRequest("POST", `/api/trading-post/adventures/${id}/download`, {});
      const downloadData = await downloadResponse.json();

      if (!downloadData.camlData) {
        throw new Error("This adventure has no CAML data to import");
      }

      const importResponse = await apiRequest("POST", "/api/caml/import", {
        content: JSON.stringify(downloadData.camlData),
        format: "json",
        createCampaign: true,
        campaignLength: "standard",
      });
      return importResponse.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/trading-post/adventures", selectedAdventure] });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      const npcs = data.imported?.npcs ?? 0;
      const quests = data.imported?.quests ?? 0;
      toast({
        title: "Adventure Imported!",
        description: `Campaign created with ${npcs} NPC${npcs !== 1 ? "s" : ""} and ${quests} quest${quests !== 1 ? "s" : ""}. Find it in your Campaigns.`,
      });
      setSelectedAdventure(null);
    },
    onError: (error: any) => {
      toast({ title: "Import failed", description: error.message || "Something went wrong", variant: "destructive" });
    },
  });

  const deleteAdventureMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("DELETE", `/api/trading-post/adventures/${id}`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trading-post/adventures"] });
      setSelectedAdventure(null);
      toast({ title: "Adventure Deleted", description: "Your adventure has been removed." });
    },
    onError: (error: any) => {
      toast({ title: "Delete failed", description: error.message || "Something went wrong", variant: "destructive" });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("DELETE", `/api/trading-post/items/${id}`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trading-post/items"] });
      setSelectedItem(null);
      toast({ title: "Item Deleted", description: "Your item has been removed." });
    },
    onError: (error: any) => {
      toast({ title: "Delete failed", description: error.message || "Something went wrong", variant: "destructive" });
    },
  });

  const submitReviewMutation = useMutation({
    mutationFn: async ({ targetType, targetId, rating, comment }: { targetType: string; targetId: number; rating: number; comment: string }) => {
      const response = await apiRequest("POST", "/api/trading-post/reviews", { targetType, targetId, rating, comment: comment || undefined });
      return response.json();
    },
    onSuccess: (_, variables) => {
      if (variables.targetType === "adventure") {
        queryClient.invalidateQueries({ queryKey: ["/api/trading-post/adventures", selectedAdventure] });
      } else {
        queryClient.invalidateQueries({ queryKey: ["/api/trading-post/items", selectedItem] });
      }
      setReviewRating(0);
      setReviewComment("");
      toast({ title: "Review Submitted!", description: "Thanks for your feedback." });
    },
    onError: (error: any) => {
      toast({ title: "Review failed", description: error.message || "Something went wrong", variant: "destructive" });
    },
  });

  const { data: characters = [] } = useQuery<any[]>({
    queryKey: ["/api/characters"],
    enabled: !!user,
  });

  const { data: playerListingsData = [], isLoading: playerListingsLoading } = useQuery<any[]>({
    queryKey: ["/api/trading-post/player-listings", playerMarketSearch],
    queryFn: async () => {
      const params = new URLSearchParams({ status: "active" });
      if (playerMarketSearch) params.set("search", playerMarketSearch);
      const res = await fetch(`/api/trading-post/player-listings?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch player listings");
      return res.json();
    },
  });

  const { data: myListings = [] } = useQuery<any[]>({
    queryKey: ["/api/trading-post/player-listings", "my-listings", user?.id],
    queryFn: async () => {
      const res = await fetch(`/api/trading-post/player-listings?status=active`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch listings");
      const all = await res.json();
      return all.filter((l: any) => l.seller_id === user?.id);
    },
    enabled: !!user,
  });

  const createListingMutation = useMutation({
    mutationFn: async (data: { characterId: number; inventoryIndex: number; askingPrice: number }) => {
      const res = await apiRequest("POST", "/api/trading-post/player-listings", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trading-post/player-listings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/characters"] });
      setListItemDialogOpen(false);
      setSelectedListItem("");
      setListAskingPrice(10);
      toast({ title: "Item Listed!", description: "Your item is now on the Player Market." });
    },
    onError: (error: any) => {
      toast({ title: "Failed to list item", description: error.message || "Something went wrong", variant: "destructive" });
    },
  });

  const buyListingMutation = useMutation({
    mutationFn: async ({ listingId, characterId }: { listingId: number; characterId: number }) => {
      const res = await apiRequest("POST", `/api/trading-post/player-listings/${listingId}/buy`, { characterId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trading-post/player-listings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/characters"] });
      setBuyingCharacter(null);
      toast({ title: "Purchase Complete!", description: "The item has been added to your inventory." });
    },
    onError: (error: any) => {
      toast({ title: "Purchase failed", description: error.message || "Something went wrong", variant: "destructive" });
    },
  });

  const cancelListingMutation = useMutation({
    mutationFn: async (listingId: number) => {
      const res = await apiRequest("DELETE", `/api/trading-post/player-listings/${listingId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trading-post/player-listings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/characters"] });
      toast({ title: "Listing Cancelled", description: "Item returned to your inventory." });
    },
    onError: (error: any) => {
      toast({ title: "Failed to cancel", description: error.message || "Something went wrong", variant: "destructive" });
    },
  });

  const selectedCharForListing = characters.find((c: any) => c.id === selectedListCharacter);
  const inventoryItems = selectedCharForListing?.equipment?.map((item: any) => {
    if (typeof item === 'string') {
      try { return JSON.parse(item); } catch { return { name: item }; }
    }
    return item;
  }) || [];

  const adventures = adventuresData?.adventures || [];
  const itemsList = itemsData?.items || [];

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-xl bg-gradient-to-br from-amber-900/40 via-orange-900/30 to-slate-900/40 border border-amber-500/20 p-8 mb-8">
        <div
          className="absolute inset-0 opacity-25 rounded-xl"
          style={{
            backgroundImage: `url(${parchmentFrame})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            mixBlendMode: "overlay",
          }}
        />
        <div className="absolute top-4 right-8 opacity-10">
          <Package className="h-20 w-20 text-amber-300" />
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm">
              <Scroll className="h-3 w-3" />
              <span>Marketplace</span>
            </div>
          </div>
          <h1 className="text-3xl font-fantasy font-bold text-white mb-3">Trading Post</h1>
          <p className="text-lg text-white/70 mb-6">
            Share and discover adventures, items, and homebrew content from the community
          </p>
          {user && (
            <div className="flex gap-3 flex-wrap">
              <Button
                className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
                onClick={() => setShowPublishAdventure(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Share Adventure
              </Button>
              <Button
                variant="outline"
                className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                onClick={() => setShowPublishItem(true)}
              >
                <Gem className="mr-2 h-4 w-4" />
                Share Item
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* Tab Navigation */}
      <SidebarTabs value={activeTab} onValueChange={setActiveTab}>
        <SidebarTabsList className="bg-slate-800/50 border border-amber-500/10">
          <SidebarTabsTrigger value="adventures" className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400">
            <BookOpen className="h-4 w-4 mr-2" />
            Adventures
          </SidebarTabsTrigger>
          <SidebarTabsTrigger value="items" className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400">
            <Gem className="h-4 w-4 mr-2" />
            Items
          </SidebarTabsTrigger>
          <SidebarTabsTrigger value="player-market" className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400">
            <Users className="h-4 w-4 mr-2" />
            Player Market
          </SidebarTabsTrigger>
        </SidebarTabsList>

        {/* Adventures Tab */}
        <TabsContent value="adventures" className="space-y-6">
          {/* Search & Filter Bar */}
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search adventures..."
                value={adventureSearch}
                onChange={(e) => setAdventureSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={adventureDifficulty} onValueChange={setAdventureDifficulty}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Difficulty" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Difficulties</SelectItem>
                <SelectItem value="easy">Easy</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="hard">Hard</SelectItem>
                <SelectItem value="deadly">Deadly</SelectItem>
              </SelectContent>
            </Select>
            <Select value={adventureGenre} onValueChange={setAdventureGenre}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Genre" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Genres</SelectItem>
                <SelectItem value="fantasy">Fantasy</SelectItem>
                <SelectItem value="horror">Horror</SelectItem>
                <SelectItem value="mystery">Mystery</SelectItem>
                <SelectItem value="sci-fi">Sci-Fi</SelectItem>
                <SelectItem value="comedy">Comedy</SelectItem>
              </SelectContent>
            </Select>
            <Select value={adventureSort} onValueChange={setAdventureSort}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="popular">Popular</SelectItem>
                <SelectItem value="top_rated">Top Rated</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Adventure Card Grid */}
          {adventuresLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
            </div>
          ) : adventures.length === 0 ? (
            <Card className="text-center py-12 bg-slate-900/50 border-amber-500/10">
              <CardContent>
                <Scroll className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                <h3 className="text-xl font-semibold mb-2">No Adventures Found</h3>
                <p className="text-muted-foreground mb-4">
                  Be the first to share an adventure with the community!
                </p>
                {user && (
                  <Button onClick={() => setShowPublishAdventure(true)} className="bg-gradient-to-r from-amber-500 to-orange-500">
                    <Plus className="mr-2 h-4 w-4" />
                    Share Adventure
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {adventures.map((adventure) => (
                <Card
                  key={adventure.id}
                  className="overflow-hidden cursor-pointer hover:border-amber-500/40 transition-all hover:shadow-lg hover:shadow-amber-500/5 bg-slate-900/50 border-amber-500/10"
                  onClick={() => setSelectedAdventure(adventure.id)}
                >
                  <div className="h-40 overflow-hidden">
                    <AdventureCoverArt
                      coverImageUrl={adventure.coverImageUrl}
                      title={adventure.title}
                      seed={adventure.id}
                      genre={adventure.genre}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <CardContent className="p-4 space-y-3">
                    <div>
                      <h3 className="font-fantasy font-bold text-lg text-white line-clamp-1">{adventure.title}</h3>
                      <p className="text-sm text-muted-foreground">by {adventure.authorUsername}</p>
                    </div>
                    <p className="text-sm text-white/60 line-clamp-2">{adventure.shortDescription || adventure.description}</p>
                    {adventure.tags && adventure.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {adventure.tags.slice(0, 3).map((tag) => (
                          <Badge key={tag} variant="outline" className="text-xs px-1.5 py-0 border-amber-500/20 text-amber-400/70">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-2 border-t border-amber-500/10">
                      <Badge variant="outline" className={`capitalize text-xs ${difficultyColors[adventure.difficulty] || difficultyColors.medium}`}>
                        {adventure.difficulty}
                      </Badge>
                      <div className="flex items-center gap-3 text-sm">
                        <div className="flex items-center gap-1 text-amber-400">
                          <Star className="h-3 w-3 fill-amber-400" />
                          <span>{adventure.avgRating || 0}</span>
                        </div>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Download className="h-3 w-3" />
                          <span>{adventure.downloadCount || 0}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Items Tab */}
        <TabsContent value="items" className="space-y-6">
          {/* Search & Filter Bar */}
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search items..."
                value={itemSearch}
                onChange={(e) => setItemSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={itemType} onValueChange={setItemType}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Item Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="weapon">Weapon</SelectItem>
                <SelectItem value="armor">Armor</SelectItem>
                <SelectItem value="potion">Potion</SelectItem>
                <SelectItem value="wondrous">Wondrous</SelectItem>
                <SelectItem value="ring">Ring</SelectItem>
                <SelectItem value="wand">Wand</SelectItem>
                <SelectItem value="scroll">Scroll</SelectItem>
              </SelectContent>
            </Select>
            <Select value={itemRarity} onValueChange={setItemRarity}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Rarity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Rarities</SelectItem>
                <SelectItem value="common">Common</SelectItem>
                <SelectItem value="uncommon">Uncommon</SelectItem>
                <SelectItem value="rare">Rare</SelectItem>
                <SelectItem value="very_rare">Very Rare</SelectItem>
                <SelectItem value="legendary">Legendary</SelectItem>
                <SelectItem value="artifact">Artifact</SelectItem>
              </SelectContent>
            </Select>
            <Select value={itemSort} onValueChange={setItemSort}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="popular">Popular</SelectItem>
                <SelectItem value="top_rated">Top Rated</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Item Card Grid */}
          {itemsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
            </div>
          ) : itemsList.length === 0 ? (
            <Card className="text-center py-12 bg-slate-900/50 border-amber-500/10">
              <CardContent>
                <Gem className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                <h3 className="text-xl font-semibold mb-2">No Items Found</h3>
                <p className="text-muted-foreground mb-4">
                  Share your homebrew items with fellow adventurers!
                </p>
                {user && (
                  <Button onClick={() => setShowPublishItem(true)} className="bg-gradient-to-r from-amber-500 to-orange-500">
                    <Gem className="mr-2 h-4 w-4" />
                    Share Item
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {itemsList.map((item) => (
                <Card
                  key={item.id}
                  className="overflow-hidden cursor-pointer hover:border-amber-500/40 transition-all hover:shadow-lg hover:shadow-amber-500/5 bg-slate-900/50 border-amber-500/10"
                  onClick={() => setSelectedItem(item.id)}
                >
                  {item.imageUrl ? (
                    <div className="h-40 overflow-hidden">
                      <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="h-40 bg-gradient-to-br from-purple-900/40 to-indigo-900/30 flex items-center justify-center">
                      <Gem className="h-12 w-12 text-purple-500/30" />
                    </div>
                  )}
                  <CardContent className="p-4 space-y-3">
                    <div>
                      <h3 className="font-fantasy font-bold text-lg text-white line-clamp-1">{item.name}</h3>
                      <p className="text-sm text-muted-foreground">by {item.authorUsername}</p>
                    </div>
                    <p className="text-sm text-white/60 line-clamp-2">{item.description}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className={`capitalize text-xs ${rarityColors[item.rarity] || rarityColors.common}`}>
                        {item.rarity.replace("_", " ")}
                      </Badge>
                      <Badge variant="outline" className="capitalize text-xs border-slate-500/30 text-slate-400">
                        {item.itemType}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-amber-500/10">
                      <div className="flex items-center gap-1 text-amber-400 text-sm">
                        <Star className="h-3 w-3 fill-amber-400" />
                        <span>{item.avgRating || 0}</span>
                      </div>
                      <div className="flex items-center gap-1 text-muted-foreground text-sm">
                        <Download className="h-3 w-3" />
                        <span>{item.downloadCount || 0}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Player Market Tab */}
        <TabsContent value="player-market" className="space-y-6">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search player listings..."
                value={playerMarketSearch}
                onChange={(e) => setPlayerMarketSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            {user && characters.length > 0 && (
              <Button
                onClick={() => setListItemDialogOpen(true)}
                className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
              >
                <Plus className="h-4 w-4 mr-2" />
                List an Item
              </Button>
            )}
          </div>

          {myListings.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-amber-400 flex items-center gap-2">
                <Package className="h-4 w-4" />
                Your Active Listings
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {myListings.map((listing: any) => {
                  const itemData = typeof listing.item_data === 'string' ? JSON.parse(listing.item_data) : listing.item_data;
                  return (
                    <Card key={listing.id} className="bg-amber-500/5 border-amber-500/20">
                      <CardContent className="p-4 flex items-center justify-between">
                        <div>
                          <p className="font-medium text-amber-300">{listing.item_name}</p>
                          <p className="text-xs text-muted-foreground">Listed by {listing.character_name}</p>
                          <p className="text-sm text-yellow-500 font-bold mt-1">{listing.asking_price} gp</p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                          onClick={() => cancelListingMutation.mutate(listing.id)}
                          disabled={cancelListingMutation.isPending}
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          Cancel
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {playerListingsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
            </div>
          ) : playerListingsData.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <Package className="h-12 w-12 mx-auto text-muted-foreground/50" />
              <p className="text-muted-foreground">No player items for sale right now.</p>
              <p className="text-sm text-muted-foreground/70">Be the first to list an item from your inventory!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {playerListingsData.filter((l: any) => l.seller_id !== user?.id).map((listing: any) => {
                const itemData = typeof listing.item_data === 'string' ? JSON.parse(listing.item_data) : listing.item_data;
                return (
                  <Card key={listing.id} className="bg-slate-800/50 border-slate-700/50 hover:border-amber-500/30 transition-colors">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-medium text-slate-200">{listing.item_name}</h4>
                          {itemData?.rarity && (
                            <Badge variant="secondary" className={`text-xs mt-1 ${rarityColors[itemData.rarity] || ''}`}>
                              {itemData.rarity}
                            </Badge>
                          )}
                        </div>
                        <span className="text-lg font-bold text-yellow-500">{listing.asking_price} gp</span>
                      </div>
                      {itemData?.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">{itemData.description}</p>
                      )}
                      {(itemData?.damage || itemData?.armor) && (
                        <div className="flex gap-3 text-xs">
                          {itemData.damage && <span className="flex items-center gap-1"><Swords className="h-3 w-3 text-red-400" />{itemData.damage}</span>}
                          {itemData.armor && <span className="flex items-center gap-1"><Shield className="h-3 w-3 text-blue-400" />AC {itemData.armor}</span>}
                        </div>
                      )}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-700/50">
                        <span className="text-xs text-muted-foreground">Seller: {listing.seller_username || 'Unknown'}</span>
                        {user && characters.length > 0 && (
                          <div className="flex items-center gap-2">
                            <Select value={buyingCharacter?.toString() || ''} onValueChange={(v) => setBuyingCharacter(parseInt(v))}>
                              <SelectTrigger className="w-[120px] h-8 text-xs">
                                <SelectValue placeholder="Character..." />
                              </SelectTrigger>
                              <SelectContent>
                                {characters.map((c: any) => (
                                  <SelectItem key={c.id} value={c.id.toString()}>{c.name} ({c.gold || 0}g)</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700 h-8"
                              disabled={!buyingCharacter || buyListingMutation.isPending}
                              onClick={() => buyingCharacter && buyListingMutation.mutate({ listingId: listing.id, characterId: buyingCharacter })}
                            >
                              Buy
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </SidebarTabs>

      {/* List Item Dialog */}
      <Dialog open={listItemDialogOpen} onOpenChange={setListItemDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>List an Item for Sale</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Character</Label>
              <Select value={selectedListCharacter?.toString() || ''} onValueChange={(v) => { setSelectedListCharacter(parseInt(v)); setSelectedListItem(''); }}>
                <SelectTrigger><SelectValue placeholder="Select character..." /></SelectTrigger>
                <SelectContent>
                  {characters.map((c: any) => (
                    <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedListCharacter && (
              <div className="space-y-2">
                <Label>Item from Inventory</Label>
                {inventoryItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No items in inventory.</p>
                ) : (
                  <Select value={selectedListItem} onValueChange={setSelectedListItem}>
                    <SelectTrigger><SelectValue placeholder="Select item..." /></SelectTrigger>
                    <SelectContent>
                      {inventoryItems.map((item: any, i: number) => (
                        <SelectItem key={i} value={`idx-${i}`}>
                          {item.name || `Unknown Item #${i + 1}`}{item.equipped ? " [Equipped]" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}
            {selectedListItem && (() => {
              const idx = parseInt(selectedListItem.replace('idx-', ''));
              const item = inventoryItems[idx];
              return item?.equipped ? (
                <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-lg text-sm">
                  <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <span className="text-amber-800 dark:text-amber-300">
                    This item is currently equipped. Listing it will unequip it from your character.
                  </span>
                </div>
              ) : null;
            })()}
            <div className="space-y-2">
              <Label>Asking Price (gp)</Label>
              <Input
                type="number"
                min={1}
                value={listAskingPrice}
                onChange={(e) => setListAskingPrice(Math.max(1, parseInt(e.target.value) || 1))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setListItemDialogOpen(false)}>Cancel</Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700"
              disabled={!selectedListCharacter || !selectedListItem || createListingMutation.isPending}
              onClick={() => {
                const idx = parseInt(selectedListItem.replace('idx-', ''));
                if (idx >= 0 && idx < inventoryItems.length && selectedListCharacter) {
                  createListingMutation.mutate({
                    characterId: selectedListCharacter,
                    inventoryIndex: idx,
                    askingPrice: listAskingPrice,
                  });
                }
              }}
            >
              {createListingMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              List for Sale
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Adventure Detail Dialog */}
      <Dialog open={selectedAdventure !== null} onOpenChange={(open) => { if (!open) { setSelectedAdventure(null); setReviewRating(0); setReviewComment(""); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          {adventureDetailLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
            </div>
          ) : adventureDetail ? (
            <>
              <DialogHeader className="space-y-0 pb-0">
                <div className="h-48 -mx-6 -mt-6 mb-4 overflow-hidden rounded-t-lg">
                  <AdventureCoverArt
                    coverImageUrl={adventureDetail.coverImageUrl}
                    title={adventureDetail.title}
                    seed={adventureDetail.id}
                    genre={adventureDetail.genre}
                    className="w-full h-full object-cover"
                  />
                </div>
                <DialogTitle className="font-fantasy text-2xl text-white">{adventureDetail.title}</DialogTitle>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>by {adventureDetail.author?.username || "Unknown"}</span>
                  <span>•</span>
                  <span>{new Date(adventureDetail.createdAt).toLocaleDateString()}</span>
                </div>
              </DialogHeader>
              <ScrollArea className="flex-1 -mx-6 px-6">
                <div className="space-y-6 pb-4">
                  <p className="text-white/80 whitespace-pre-wrap">{adventureDetail.description}</p>

                  <div className="flex flex-wrap gap-3">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/50 text-sm">
                      <Shield className="h-4 w-4 text-amber-400" />
                      <span className="capitalize">{adventureDetail.difficulty}</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/50 text-sm">
                      <Users className="h-4 w-4 text-blue-400" />
                      <span>{adventureDetail.playerCountMin}-{adventureDetail.playerCountMax} players</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/50 text-sm">
                      <Clock className="h-4 w-4 text-green-400" />
                      <span>{adventureDetail.estimatedSessions} session{(adventureDetail.estimatedSessions || 1) !== 1 ? "s" : ""}</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/50 text-sm">
                      <MapPin className="h-4 w-4 text-purple-400" />
                      <span className="capitalize">{adventureDetail.genre}</span>
                    </div>
                  </div>

                  {adventureDetail.tags && adventureDetail.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {adventureDetail.tags.map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs border-amber-500/20 text-amber-400/70">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <StarRating rating={adventureDetail.avgRating || 0} />
                      <span className="text-sm text-muted-foreground">({adventureDetail.totalRatings || 0} ratings)</span>
                    </div>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Download className="h-4 w-4" />
                      <span>{adventureDetail.downloadCount || 0} downloads</span>
                    </div>
                  </div>

                  {/* Reviews */}
                  <div className="space-y-4">
                    <h4 className="font-semibold text-white flex items-center gap-2">
                      <Heart className="h-4 w-4 text-red-400" />
                      Reviews
                    </h4>

                    {user && (
                      <div className="p-4 rounded-lg bg-slate-800/40 border border-slate-700/50 space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">Your rating:</span>
                          <StarRating rating={reviewRating} onRate={setReviewRating} interactive />
                        </div>
                        <Textarea
                          placeholder="Write a review..."
                          value={reviewComment}
                          onChange={(e) => setReviewComment(e.target.value)}
                          rows={2}
                        />
                        <Button
                          size="sm"
                          disabled={reviewRating === 0 || submitReviewMutation.isPending}
                          onClick={() => submitReviewMutation.mutate({ targetType: "adventure", targetId: selectedAdventure!, rating: reviewRating, comment: reviewComment })}
                        >
                          {submitReviewMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                          Submit Review
                        </Button>
                      </div>
                    )}

                    {adventureDetail.reviews && adventureDetail.reviews.length > 0 ? (
                      <div className="space-y-3">
                        {adventureDetail.reviews.map((review) => (
                          <div key={review.id} className="p-3 rounded-lg bg-slate-800/30 border border-slate-700/30">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium text-white">{review.username}</span>
                              <StarRating rating={review.rating} />
                            </div>
                            {review.comment && <p className="text-sm text-white/60">{review.comment}</p>}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">No reviews yet. Be the first!</p>
                    )}
                  </div>
                </div>
              </ScrollArea>
              <DialogFooter className="flex-row gap-2 pt-4 border-t border-slate-700/50">
                {user && adventureDetail.authorId === user.id && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => deleteAdventureMutation.mutate(adventureDetail.id)}
                    disabled={deleteAdventureMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                )}
                <div className="flex-1" />
                <Button
                  className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
                  onClick={() => downloadAdventureMutation.mutate(adventureDetail.id)}
                  disabled={downloadAdventureMutation.isPending || !user}
                >
                  {downloadAdventureMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
                  Import Adventure
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Item Detail Dialog */}
      <Dialog open={selectedItem !== null} onOpenChange={(open) => { if (!open) { setSelectedItem(null); setReviewRating(0); setReviewComment(""); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          {itemDetailLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
            </div>
          ) : itemDetail ? (
            <>
              <DialogHeader className="space-y-0 pb-0">
                {itemDetail.imageUrl && (
                  <div className="h-48 -mx-6 -mt-6 mb-4 overflow-hidden rounded-t-lg">
                    <img src={itemDetail.imageUrl} alt={itemDetail.name} className="w-full h-full object-cover" />
                  </div>
                )}
                <DialogTitle className="font-fantasy text-2xl text-white">{itemDetail.name}</DialogTitle>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>by {itemDetail.author?.username || "Unknown"}</span>
                  <span>•</span>
                  <span>{new Date(itemDetail.createdAt).toLocaleDateString()}</span>
                </div>
              </DialogHeader>
              <ScrollArea className="flex-1 -mx-6 px-6">
                <div className="space-y-6 pb-4">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={`capitalize ${rarityColors[itemDetail.rarity] || rarityColors.common}`}>
                      {itemDetail.rarity.replace("_", " ")}
                    </Badge>
                    <Badge variant="outline" className="capitalize border-slate-500/30 text-slate-400">
                      {itemDetail.itemType}
                    </Badge>
                  </div>

                  <p className="text-white/80 whitespace-pre-wrap">{itemDetail.description}</p>

                  {itemDetail.lore && (
                    <div className="p-4 rounded-lg bg-amber-900/10 border border-amber-500/20">
                      <h4 className="text-sm font-semibold text-amber-400 mb-2 flex items-center gap-1.5">
                        <BookOpen className="h-4 w-4" />
                        Lore
                      </h4>
                      <p className="text-sm text-white/70 italic whitespace-pre-wrap">{itemDetail.lore}</p>
                    </div>
                  )}

                  {(() => {
                    const statsObj = itemDetail.stats as Record<string, string> | null;
                    if (!statsObj || typeof statsObj !== "object") return null;
                    const entries = Object.entries(statsObj);
                    if (entries.length === 0) return null;
                    return (
                      <div className="space-y-2">
                        <h4 className="text-sm font-semibold text-white flex items-center gap-1.5">
                          <Swords className="h-4 w-4 text-amber-400" />
                          Stats
                        </h4>
                        <div className="grid grid-cols-2 gap-2">
                          {entries.map(([key, value]) => (
                            <div key={key} className="flex justify-between p-2 rounded bg-slate-800/40 border border-slate-700/30">
                              <span className="text-sm text-muted-foreground capitalize">{key}</span>
                              <span className="text-sm text-white font-medium">{String(value)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {itemDetail.tags && itemDetail.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {itemDetail.tags.map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs border-amber-500/20 text-amber-400/70">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <StarRating rating={itemDetail.avgRating || 0} />
                      <span className="text-sm text-muted-foreground">({itemDetail.totalRatings || 0} ratings)</span>
                    </div>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Download className="h-4 w-4" />
                      <span>{itemDetail.downloadCount || 0} downloads</span>
                    </div>
                  </div>

                  {/* Reviews */}
                  <div className="space-y-4">
                    <h4 className="font-semibold text-white flex items-center gap-2">
                      <Heart className="h-4 w-4 text-red-400" />
                      Reviews
                    </h4>

                    {user && (
                      <div className="p-4 rounded-lg bg-slate-800/40 border border-slate-700/50 space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">Your rating:</span>
                          <StarRating rating={reviewRating} onRate={setReviewRating} interactive />
                        </div>
                        <Textarea
                          placeholder="Write a review..."
                          value={reviewComment}
                          onChange={(e) => setReviewComment(e.target.value)}
                          rows={2}
                        />
                        <Button
                          size="sm"
                          disabled={reviewRating === 0 || submitReviewMutation.isPending}
                          onClick={() => submitReviewMutation.mutate({ targetType: "item", targetId: selectedItem!, rating: reviewRating, comment: reviewComment })}
                        >
                          {submitReviewMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                          Submit Review
                        </Button>
                      </div>
                    )}

                    {itemDetail.reviews && itemDetail.reviews.length > 0 ? (
                      <div className="space-y-3">
                        {itemDetail.reviews.map((review) => (
                          <div key={review.id} className="p-3 rounded-lg bg-slate-800/30 border border-slate-700/30">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium text-white">{review.username}</span>
                              <StarRating rating={review.rating} />
                            </div>
                            {review.comment && <p className="text-sm text-white/60">{review.comment}</p>}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">No reviews yet. Be the first!</p>
                    )}
                  </div>
                </div>
              </ScrollArea>
              <DialogFooter className="flex-row gap-2 pt-4 border-t border-slate-700/50">
                {user && itemDetail.authorId === user.id && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => deleteItemMutation.mutate(itemDetail.id)}
                    disabled={deleteItemMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                )}
                <div className="flex-1" />
                <Button
                  className="bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600"
                  disabled={!user}
                >
                  <Package className="h-4 w-4 mr-2" />
                  Copy to Inventory
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Publish Adventure Dialog */}
      <Dialog open={showPublishAdventure} onOpenChange={setShowPublishAdventure}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="font-fantasy text-xl">Share an Adventure</DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="space-y-4 pb-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  placeholder="The Lost Temple of Shadows..."
                  value={newAdventure.title}
                  onChange={(e) => setNewAdventure({ ...newAdventure, title: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  placeholder="Describe your adventure in detail..."
                  value={newAdventure.description}
                  onChange={(e) => setNewAdventure({ ...newAdventure, description: e.target.value })}
                  rows={4}
                />
              </div>
              <div className="space-y-2">
                <Label>Short Description (shown in cards)</Label>
                <Textarea
                  placeholder="A brief summary for the card preview..."
                  value={newAdventure.shortDescription}
                  onChange={(e) => setNewAdventure({ ...newAdventure, shortDescription: e.target.value })}
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label>CAML Data (optional)</Label>
                <Textarea
                  placeholder="Paste CAML YAML or JSON data here..."
                  value={newAdventure.camlData}
                  onChange={(e) => setNewAdventure({ ...newAdventure, camlData: e.target.value })}
                  rows={3}
                  className="font-mono text-xs"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Difficulty</Label>
                  <Select value={newAdventure.difficulty} onValueChange={(v) => setNewAdventure({ ...newAdventure, difficulty: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="easy">Easy</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="hard">Hard</SelectItem>
                      <SelectItem value="deadly">Deadly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Genre</Label>
                  <Select value={newAdventure.genre} onValueChange={(v) => setNewAdventure({ ...newAdventure, genre: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fantasy">Fantasy</SelectItem>
                      <SelectItem value="horror">Horror</SelectItem>
                      <SelectItem value="mystery">Mystery</SelectItem>
                      <SelectItem value="sci-fi">Sci-Fi</SelectItem>
                      <SelectItem value="comedy">Comedy</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Min Players</Label>
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    value={newAdventure.playerCountMin}
                    onChange={(e) => setNewAdventure({ ...newAdventure, playerCountMin: parseInt(e.target.value) || 1 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max Players</Label>
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    value={newAdventure.playerCountMax}
                    onChange={(e) => setNewAdventure({ ...newAdventure, playerCountMax: parseInt(e.target.value) || 5 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Sessions</Label>
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={newAdventure.estimatedSessions}
                    onChange={(e) => setNewAdventure({ ...newAdventure, estimatedSessions: parseInt(e.target.value) || 1 })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Tags (comma separated)</Label>
                <Input
                  placeholder="dungeon, undead, puzzle..."
                  value={newAdventure.tags}
                  onChange={(e) => setNewAdventure({ ...newAdventure, tags: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Cover Image URL (optional, auto-generated if blank)</Label>
                <Input
                  placeholder="https://..."
                  value={newAdventure.coverImageUrl}
                  onChange={(e) => setNewAdventure({ ...newAdventure, coverImageUrl: e.target.value })}
                />
              </div>
            </div>
          </ScrollArea>
          <DialogFooter className="pt-4 border-t border-slate-700/50">
            <Button variant="outline" onClick={() => setShowPublishAdventure(false)}>
              Cancel
            </Button>
            <Button
              className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
              disabled={!newAdventure.title.trim() || !newAdventure.description.trim() || publishAdventureMutation.isPending}
              onClick={() => publishAdventureMutation.mutate(newAdventure)}
            >
              {publishAdventureMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              Publish Adventure
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Publish Item Dialog - Inventory Based */}
      <Dialog open={showPublishItem} onOpenChange={(open) => {
        setShowPublishItem(open);
        if (!open) {
          setShareCharacterId(null);
          setShareSelectedItem("");
          setShareLore("");
          setShareTags("");
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-fantasy text-xl">Share an Item from Inventory</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {characters.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-4">You need a character with items to share.</p>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Character</Label>
                  <Select
                    value={shareCharacterId?.toString() || ""}
                    onValueChange={(v) => {
                      setShareCharacterId(parseInt(v));
                      setShareSelectedItem("");
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a character" />
                    </SelectTrigger>
                    <SelectContent>
                      {characters.map((c: any) => (
                        <SelectItem key={c.id} value={c.id.toString()}>
                          {c.name} (Lv.{c.level || 1} {c.class})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {shareCharacterId && (() => {
                  const selectedChar = characters.find((c: any) => c.id === shareCharacterId);
                  const equipmentItems: { name: string; index: number; raw: string; type?: string; rarity?: string }[] = [];
                  if (selectedChar?.equipment) {
                    selectedChar.equipment.forEach((item: string, idx: number) => {
                      try {
                        const parsed = JSON.parse(item);
                        equipmentItems.push({ name: parsed.name || item, index: idx, raw: item, type: parsed.type, rarity: parsed.rarity });
                      } catch {
                        equipmentItems.push({ name: item, index: idx, raw: item });
                      }
                    });
                  }
                  return equipmentItems.length === 0 ? (
                    <p className="text-muted-foreground text-sm text-center py-2">This character has no items in their inventory.</p>
                  ) : (
                    <div className="space-y-2">
                      <Label>Item from Inventory</Label>
                      <Select value={shareSelectedItem} onValueChange={setShareSelectedItem}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select an item to share" />
                        </SelectTrigger>
                        <SelectContent>
                          {equipmentItems.map((item) => (
                            <SelectItem key={item.index} value={item.index.toString()}>
                              {item.name}{item.rarity && item.rarity !== 'common' ? ` (${item.rarity})` : ''}{item.type ? ` - ${item.type}` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })()}
                <div className="space-y-2">
                  <Label>Lore (optional)</Label>
                  <Textarea
                    placeholder="The history and legends behind this item..."
                    value={shareLore}
                    onChange={(e) => setShareLore(e.target.value)}
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tags (comma separated)</Label>
                  <Input
                    placeholder="magical, cursed, legendary..."
                    value={shareTags}
                    onChange={(e) => setShareTags(e.target.value)}
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter className="pt-4 border-t border-slate-700/50">
            <Button variant="outline" onClick={() => setShowPublishItem(false)}>
              Cancel
            </Button>
            <Button
              className="bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600"
              disabled={!shareCharacterId || shareSelectedItem === "" || publishItemMutation.isPending}
              onClick={() => {
                if (!shareCharacterId || shareSelectedItem === "") return;
                const selectedChar = characters.find((c: any) => c.id === shareCharacterId);
                const idx = parseInt(shareSelectedItem);
                const itemRaw = selectedChar?.equipment?.[idx] || "";
                publishItemMutation.mutate({
                  characterId: shareCharacterId,
                  itemRaw,
                  lore: shareLore,
                  tags: shareTags,
                });
              }}
            >
              {publishItemMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Gem className="h-4 w-4 mr-2" />}
              Share Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
