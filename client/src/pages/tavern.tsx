import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  Beer, 
  ShoppingBag, 
  Wrench, 
  Users, 
  Coins, 
  Sword, 
  Shield,
  Sparkles,
  Package,
  ChevronRight,
  Heart,
  Zap,
  Star,
  RefreshCw,
  AlertCircle,
  Check,
  X,
  Weight,
  AlertTriangle,
  Scroll,
  PenLine,
  MessageSquare,
  Clock
} from "lucide-react";
import { Link } from "wouter";
import { formatDistanceToNow } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ShopItem {
  id: string;
  name: string;
  type: string;
  rarity: string;
  description: string;
  properties?: string;
  goldCost: number;
  silverCost?: number;
  damage?: string;
  armor?: number;
  weight: number;
  category: "weapons" | "armor" | "potions" | "tools" | "misc";
}

interface InventoryItem {
  name: string;
  type: string;
  rarity: string;
  description: string;
  properties?: string;
  damage?: string;
  armor?: number;
  weight?: number;
  durability?: number;
  maxDurability?: number;
  equipped?: boolean;
}

const SHOP_INVENTORY: ShopItem[] = [
  {
    id: "longsword",
    name: "Longsword",
    type: "Martial Melee Weapon",
    rarity: "common",
    description: "A versatile sword favored by warriors and adventurers alike.",
    damage: "1d8 slashing (versatile 1d10)",
    goldCost: 15,
    weight: 3,
    category: "weapons"
  },
  {
    id: "shortbow",
    name: "Shortbow",
    type: "Simple Ranged Weapon",
    rarity: "common",
    description: "A compact bow ideal for quick shots.",
    damage: "1d6 piercing",
    goldCost: 25,
    weight: 2,
    category: "weapons"
  },
  {
    id: "battleaxe",
    name: "Battleaxe",
    type: "Martial Melee Weapon",
    rarity: "common",
    description: "A heavy axe perfect for cleaving through enemies.",
    damage: "1d8 slashing (versatile 1d10)",
    goldCost: 10,
    weight: 4,
    category: "weapons"
  },
  {
    id: "dagger",
    name: "Dagger",
    type: "Simple Melee Weapon",
    rarity: "common",
    description: "A small, concealable blade. Light and throwable.",
    damage: "1d4 piercing",
    properties: "Finesse, light, thrown (20/60)",
    goldCost: 2,
    weight: 1,
    category: "weapons"
  },
  {
    id: "chain-mail",
    name: "Chain Mail",
    type: "Heavy Armor",
    rarity: "common",
    description: "Interlocking metal rings provide solid protection.",
    armor: 16,
    properties: "Disadvantage on Stealth, Str 13 required",
    goldCost: 75,
    weight: 55,
    category: "armor"
  },
  {
    id: "leather-armor",
    name: "Leather Armor",
    type: "Light Armor",
    rarity: "common",
    description: "Supple leather that allows for agility.",
    armor: 11,
    properties: "+Dex modifier to AC",
    goldCost: 10,
    weight: 10,
    category: "armor"
  },
  {
    id: "scale-mail",
    name: "Scale Mail",
    type: "Medium Armor",
    rarity: "common",
    description: "Overlapping metal scales like a dragon's hide.",
    armor: 14,
    properties: "+Dex modifier (max 2), disadvantage on Stealth",
    goldCost: 50,
    weight: 45,
    category: "armor"
  },
  {
    id: "wooden-shield",
    name: "Wooden Shield",
    type: "Shield",
    rarity: "common",
    description: "A sturdy wooden shield.",
    armor: 2,
    properties: "+2 AC bonus",
    goldCost: 10,
    weight: 6,
    category: "armor"
  },
  {
    id: "healing-potion",
    name: "Potion of Healing",
    type: "Potion",
    rarity: "common",
    description: "A red liquid that glimmers when agitated. Heals 2d4+2 HP.",
    properties: "Heals 2d4+2 hit points",
    goldCost: 50,
    weight: 0.5,
    category: "potions"
  },
  {
    id: "greater-healing-potion",
    name: "Potion of Greater Healing",
    type: "Potion",
    rarity: "uncommon",
    description: "A more potent healing draught. Heals 4d4+4 HP.",
    properties: "Heals 4d4+4 hit points",
    goldCost: 150,
    weight: 0.5,
    category: "potions"
  },
  {
    id: "antitoxin",
    name: "Antitoxin",
    type: "Consumable",
    rarity: "common",
    description: "Grants advantage on saves against poison for 1 hour.",
    properties: "Advantage on poison saves for 1 hour",
    goldCost: 50,
    weight: 0.5,
    category: "potions"
  },
  {
    id: "thieves-tools",
    name: "Thieves' Tools",
    type: "Tools",
    rarity: "common",
    description: "Lockpicks and small tools for disabling traps and opening locks.",
    goldCost: 25,
    weight: 1,
    category: "tools"
  },
  {
    id: "rope-hemp",
    name: "Rope (50 ft, Hemp)",
    type: "Adventuring Gear",
    rarity: "common",
    description: "Strong rope for climbing, binding, or other uses.",
    goldCost: 1,
    weight: 10,
    category: "misc"
  },
  {
    id: "torch-bundle",
    name: "Torches (10)",
    type: "Adventuring Gear",
    rarity: "common",
    description: "A bundle of 10 torches for lighting dark dungeons.",
    properties: "Bright light 20 ft, dim light additional 20 ft",
    goldCost: 1,
    silverCost: 0,
    weight: 10,
    category: "misc"
  },
  {
    id: "rations",
    name: "Rations (5 days)",
    type: "Adventuring Gear",
    rarity: "common",
    description: "Dried food for 5 days of travel.",
    goldCost: 2,
    silverCost: 50,
    weight: 10,
    category: "misc"
  }
];

const REPAIR_COSTS: Record<string, { gold: number; silver: number }> = {
  common: { gold: 5, silver: 0 },
  uncommon: { gold: 15, silver: 0 },
  rare: { gold: 50, silver: 0 },
  "very rare": { gold: 150, silver: 0 },
  legendary: { gold: 500, silver: 0 }
};

interface TavernDrink {
  id: string;
  name: string;
  description: string;
  effect: string;
  cost: number;
  icon: string;
}

const TAVERN_DRINKS: TavernDrink[] = [
  { id: "ale", name: "Dragon's Breath Ale", description: "A fiery brew that warms the soul", effect: "+1 to Charisma checks for the next hour", cost: 1, icon: "🍺" },
  { id: "mead", name: "Honeyed Mead", description: "Sweet golden nectar from the northern hives", effect: "Advantage on next Persuasion check", cost: 2, icon: "🍯" },
  { id: "wine", name: "Elven Starlight Wine", description: "A delicate vintage that shimmers like starlight", effect: "+1 to Wisdom saves for the next hour", cost: 5, icon: "🍷" },
  { id: "spirits", name: "Dwarven Firewater", description: "Warning: May cause temporary blindness", effect: "Disadvantage on Perception, +2 to Constitution saves", cost: 3, icon: "🥃" },
  { id: "cider", name: "Halfling Apple Cider", description: "Warm and comforting, like a hobbit hole", effect: "Restore 1d4 temporary HP", cost: 2, icon: "🍎" },
  { id: "mystery", name: "Wizard's Mystery Brew", description: "What could possibly go wrong?", effect: "Roll 1d6 for a random magical effect", cost: 10, icon: "✨" }
];

const TAVERN_RUMORS = [
  "I heard there's a dragon's hoard hidden beneath the old mill...",
  "The mayor's been acting strange lately. Some say he's been replaced by a doppelganger.",
  "Merchants from the east speak of a plague spreading through the port cities.",
  "A band of goblins has been spotted near the old ruins. They seem to be searching for something.",
  "The blacksmith's daughter went missing last fortnight. She was last seen heading toward the forest.",
  "Strange lights have been appearing over the cemetery at midnight.",
  "A traveling bard claims to know the location of an ancient temple filled with treasure.",
  "The duke is offering a reward for anyone who can rid the countryside of the werewolf menace.",
  "There's talk of a secret entrance to the Underdark hidden somewhere in the caves.",
  "The old wizard's tower has been abandoned for years, but smoke was seen rising from it yesterday."
];

interface DiceGameState {
  playerDice: number[];
  houseDice: number[];
  playerBet: number;
  playerGuess: { count: number; face: number };
  gamePhase: 'betting' | 'guessing' | 'reveal' | 'result';
  result: 'win' | 'lose' | null;
  winnings: number;
}

function getRarityColor(rarity: string): string {
  switch (rarity.toLowerCase()) {
    case "common": return "text-slate-600 dark:text-slate-400";
    case "uncommon": return "text-green-600 dark:text-green-400";
    case "rare": return "text-blue-600 dark:text-blue-400";
    case "very rare": return "text-purple-600 dark:text-purple-400";
    case "legendary": return "text-orange-600 dark:text-orange-400";
    default: return "text-slate-600";
  }
}

function getRarityBadgeVariant(rarity: string): "default" | "secondary" | "destructive" | "outline" {
  switch (rarity.toLowerCase()) {
    case "uncommon":
    case "rare":
      return "secondary";
    case "very rare":
    case "legendary":
      return "destructive";
    default:
      return "outline";
  }
}

// Component to show recent bulletin board posts in the tavern
function RecentBulletinPosts() {
  const { data: posts, isLoading } = useQuery<any[]>({
    queryKey: ['/api/bulletin'],
  });

  if (isLoading) {
    return (
      <div className="text-center py-4 text-muted-foreground">
        Loading party requests...
      </div>
    );
  }

  const recentPosts = posts?.slice(0, 4) || [];

  if (recentPosts.length === 0) {
    return (
      <Card className="bg-slate-50 dark:bg-slate-800 p-6 text-center">
        <MessageSquare className="h-10 w-10 mx-auto mb-3 text-slate-400" />
        <p className="text-muted-foreground">No party requests yet.</p>
        <p className="text-sm text-muted-foreground mt-1">Be the first to post!</p>
      </Card>
    );
  }

  return (
    <div className="grid gap-3">
      {recentPosts.map((post: any) => (
        <Link key={post.id} href="/bulletin">
          <Card className="bg-slate-50 dark:bg-slate-800 hover:border-amber-500/50 transition-colors cursor-pointer">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                {post.authorAvatarUrl ? (
                  <img 
                    src={post.authorAvatarUrl} 
                    alt={post.authorName}
                    className="w-10 h-10 rounded-full object-cover border-2 border-amber-500/50 flex-shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-600 font-bold flex-shrink-0">
                    {(post.authorName || 'U').charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="secondary" className="text-xs">
                      {post.postType === 'lfg' ? 'LFG' : post.postType === 'lfp' ? 'LFP' : post.postType?.toUpperCase() || 'LFG'}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                  <h4 className="font-semibold truncate">{post.title}</h4>
                  <p className="text-sm text-muted-foreground">by {post.authorName || 'Unknown'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}

export default function TavernPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedCharacter, setSelectedCharacter] = useState<number | null>(null);
  const [shopCategory, setShopCategory] = useState<string>("all");
  const [buyDialogOpen, setBuyDialogOpen] = useState(false);
  const [sellDialogOpen, setSellDialogOpen] = useState(false);
  const [repairDialogOpen, setRepairDialogOpen] = useState(false);
  const [selectedShopItem, setSelectedShopItem] = useState<ShopItem | null>(null);
  const [selectedInventoryItem, setSelectedInventoryItem] = useState<InventoryItem | null>(null);
  const [quantity, setQuantity] = useState(1);
  
  // Tavern social features state
  const [tavernTab, setTavernTab] = useState<'drinks' | 'party' | 'rumors' | 'games'>('drinks');
  const [currentRumor, setCurrentRumor] = useState<string>(TAVERN_RUMORS[Math.floor(Math.random() * TAVERN_RUMORS.length)]);
  const [rumorNPC, setRumorNPC] = useState<string>(() => {
    const npcs = ["A grizzled dwarf", "An elven merchant", "A hooded stranger", "The bartender", "A traveling bard", "A nervous halfling"];
    return npcs[Math.floor(Math.random() * npcs.length)];
  });
  const [lastDrinkPurchased, setLastDrinkPurchased] = useState<TavernDrink | null>(null);
  
  // Dice game state
  const [diceGame, setDiceGame] = useState<DiceGameState>({
    playerDice: [],
    houseDice: [],
    playerBet: 5,
    playerGuess: { count: 1, face: 1 },
    gamePhase: 'betting',
    result: null,
    winnings: 0
  });
  
  // Gold transfer state
  const [goldTransferOpen, setGoldTransferOpen] = useState(false);
  const [transferRecipient, setTransferRecipient] = useState<number | null>(null);
  const [transferAmount, setTransferAmount] = useState(1);
  
  const rollDice = (count: number): number[] => {
    return Array.from({ length: count }, () => Math.floor(Math.random() * 6) + 1);
  };
  
  // Mutation to update gold from dice game winnings
  const diceGameMutation = useMutation({
    mutationFn: async ({ characterId, goldChange }: { characterId: number; goldChange: number }) => {
      const response = await apiRequest("POST", `/api/characters/${characterId}/add-currency`, {
        gold: goldChange
      });
      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/characters"] });
      // Also invalidate participants queries so Campaign Panel shows updated gold
      queryClient.invalidateQueries({ predicate: (query) => 
        Array.isArray(query.queryKey) && 
        query.queryKey[0]?.toString().includes('/api/campaigns') &&
        query.queryKey[0]?.toString().includes('/participants')
      });
      if (variables.goldChange > 0) {
        toast({
          title: "Winnings Collected!",
          description: `You won ${variables.goldChange} gold at the dice table!`
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update gold",
        variant: "destructive"
      });
    }
  });
  
  const startDiceGame = () => {
    if (!activeCharacter || characterGold < diceGame.playerBet) {
      toast({ title: "Not enough gold!", variant: "destructive" });
      return;
    }
    const playerDice = rollDice(5);
    const houseDice = rollDice(5);
    setDiceGame(prev => ({
      ...prev,
      playerDice,
      houseDice,
      gamePhase: 'guessing'
    }));
  };
  
  const makeGuess = () => {
    const allDice = [...diceGame.playerDice, ...diceGame.houseDice];
    const actualCount = allDice.filter(d => d === diceGame.playerGuess.face || d === 1).length;
    const won = actualCount >= diceGame.playerGuess.count;
    const winnings = won ? diceGame.playerBet * 2 : -diceGame.playerBet;
    
    // Actually update the character's gold
    if (activeCharacter) {
      diceGameMutation.mutate({ characterId: activeCharacter.id, goldChange: winnings });
    }
    
    setDiceGame(prev => ({
      ...prev,
      gamePhase: 'result',
      result: won ? 'win' : 'lose',
      winnings
    }));
  };
  
  const resetDiceGame = () => {
    setDiceGame({
      playerDice: [],
      houseDice: [],
      playerBet: 5,
      playerGuess: { count: 1, face: 1 },
      gamePhase: 'betting',
      result: null,
      winnings: 0
    });
  };

  const { data: characters = [] } = useQuery<any[]>({
    queryKey: ["/api/characters"],
    enabled: !!user
  });

  const activeCharacter = characters.find(c => c.id === selectedCharacter) || characters[0];

  const buyItemMutation = useMutation({
    mutationFn: async ({ characterId, item, qty }: { characterId: number; item: ShopItem; qty: number }) => {
      const response = await apiRequest("POST", `/api/characters/${characterId}/buy-item`, {
        itemName: item.name,
        itemType: item.type,
        itemRarity: item.rarity,
        itemDescription: item.description,
        itemProperties: item.properties,
        itemDamage: item.damage,
        itemArmor: item.armor,
        goldCost: item.goldCost * qty,
        silverCost: (item.silverCost || 0) * qty,
        quantity: qty
      });
      return response.json();
    },
    onSuccess: async () => {
      // Force immediate refetch to update inventory display
      await queryClient.refetchQueries({ queryKey: ["/api/characters"] });
      toast({
        title: "Purchase Complete!",
        description: `You bought ${quantity}x ${selectedShopItem?.name}.`
      });
      setBuyDialogOpen(false);
      setQuantity(1);
    },
    onError: (error: any) => {
      toast({
        title: "Purchase Failed",
        description: error.message || "Not enough gold!",
        variant: "destructive"
      });
    }
  });

  const sellItemMutation = useMutation({
    mutationFn: async ({ characterId, itemName }: { characterId: number; itemName: string }) => {
      const response = await apiRequest("POST", `/api/characters/${characterId}/sell-item`, {
        itemName
      });
      return response.json();
    },
    onSuccess: async (data) => {
      // Force immediate refetch to update inventory display
      await queryClient.refetchQueries({ queryKey: ["/api/characters"] });
      toast({
        title: "Item Sold!",
        description: `You received ${data.goldReceived}gp for ${selectedInventoryItem?.name}.`
      });
      setSellDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Sale Failed",
        description: error.message || "Could not sell item.",
        variant: "destructive"
      });
    }
  });

  const transferGoldMutation = useMutation({
    mutationFn: async ({ senderId, recipientId, amount }: { senderId: number; recipientId: number; amount: number }) => {
      const response = await apiRequest("POST", `/api/characters/${senderId}/transfer-gold`, {
        recipientId,
        amount
      });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/characters"] });
      toast({
        title: "Gold Sent!",
        description: data.message
      });
      setGoldTransferOpen(false);
      setTransferAmount(1);
      setTransferRecipient(null);
    },
    onError: (error: any) => {
      toast({
        title: "Transfer Failed",
        description: error.message || "Could not transfer gold.",
        variant: "destructive"
      });
    }
  });

  const repairItemMutation = useMutation({
    mutationFn: async ({ characterId, itemName }: { characterId: number; itemName: string }) => {
      const response = await apiRequest("POST", `/api/characters/${characterId}/repair-item`, {
        itemName
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/characters"] });
      toast({
        title: "Item Repaired!",
        description: `${selectedInventoryItem?.name} has been fully restored.`
      });
      setRepairDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Repair Failed",
        description: error.message || "Could not repair item.",
        variant: "destructive"
      });
    }
  });
  
  // Drink purchase mutation
  const buyDrinkMutation = useMutation({
    mutationFn: async ({ characterId, drink }: { characterId: number; drink: TavernDrink }) => {
      const response = await apiRequest("POST", `/api/characters/${characterId}/buy-item`, {
        itemName: drink.name,
        itemType: "Beverage",
        itemRarity: "common",
        itemDescription: drink.description,
        itemProperties: drink.effect,
        goldCost: drink.cost,
        silverCost: 0,
        quantity: 1
      });
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/characters"] });
      const drink = variables.drink;
      setLastDrinkPurchased(drink);
      toast({
        title: `${drink.icon} Cheers!`,
        description: `You enjoy a ${drink.name}. ${drink.effect}`
      });
    },
    onError: (error: any) => {
      toast({
        title: "Not enough gold!",
        description: error.message || "You can't afford this drink.",
        variant: "destructive"
      });
    }
  });
  
  const hearNewRumor = async () => {
    const npcs = ["A grizzled dwarf", "An elven merchant", "A hooded stranger", "The bartender", "A traveling bard", "A nervous halfling"];
    setRumorNPC(npcs[Math.floor(Math.random() * npcs.length)]);
    
    try {
      const response = await fetch('/api/world/rumors/random');
      if (response.ok) {
        const rumor = await response.json();
        if (rumor && rumor.narrative) {
          setCurrentRumor(rumor.narrative);
          return;
        }
      }
    } catch (error) {
      console.log("Falling back to local rumors");
    }
    
    let newRumor = currentRumor;
    while (newRumor === currentRumor && TAVERN_RUMORS.length > 1) {
      newRumor = TAVERN_RUMORS[Math.floor(Math.random() * TAVERN_RUMORS.length)];
    }
    setCurrentRumor(newRumor);
  };

  const filteredShopItems = shopCategory === "all" 
    ? SHOP_INVENTORY 
    : SHOP_INVENTORY.filter(item => item.category === shopCategory);

  const characterGold = activeCharacter?.gold || 0;
  const characterSilver = activeCharacter?.silver || 0;
  // Parse equipment items - they may be stored as JSON strings or plain strings
  const characterEquipment: InventoryItem[] = (activeCharacter?.equipment || []).map((item: string | InventoryItem) => {
    if (typeof item === 'string') {
      // Try to parse as JSON, otherwise treat as simple item name
      try {
        return JSON.parse(item);
      } catch {
        return { name: item, type: 'misc', rarity: 'common', description: '' };
      }
    }
    return item;
  });

  // Encumbrance system (D&D 5e: Carrying Capacity = Strength × 15)
  const getItemWeight = (item: InventoryItem): number => {
    // First check if item has weight stored
    if (item.weight !== undefined) return item.weight;
    // Otherwise look up from shop inventory
    const shopItem = SHOP_INVENTORY.find(si => si.name === item.name);
    if (shopItem) return shopItem.weight;
    // Default weights by type
    switch (item.type?.toLowerCase()) {
      case 'martial melee weapon':
      case 'martial ranged weapon':
        return 4;
      case 'simple melee weapon':
      case 'simple ranged weapon':
        return 2;
      case 'heavy armor':
        return 55;
      case 'medium armor':
        return 40;
      case 'light armor':
        return 10;
      case 'shield':
        return 6;
      case 'potion':
      case 'consumable':
        return 0.5;
      default:
        return 1;
    }
  };

  const characterStrength = activeCharacter?.strength || 10;
  const carryingCapacity = characterStrength * 15; // D&D 5e standard
  const totalInventoryWeight = characterEquipment.reduce((total, item) => total + getItemWeight(item), 0);
  const encumbrancePercent = Math.min((totalInventoryWeight / carryingCapacity) * 100, 100);
  const isOverburdened = totalInventoryWeight > carryingCapacity;
  const isEncumbered = totalInventoryWeight > carryingCapacity * 0.66; // 2/3 capacity = encumbered

  const canAfford = (item: ShopItem | null, qty: number = 1) => {
    if (!item) return false;
    const totalGold = item.goldCost * qty;
    const totalSilver = (item.silverCost || 0) * qty;
    const playerTotalSilver = characterGold * 10 + characterSilver;
    const itemTotalSilver = totalGold * 10 + totalSilver;
    return playerTotalSilver >= itemTotalSilver;
  };

  const getSellPrice = (item: InventoryItem | null) => {
    if (!item) return 0;
    const shopItem = SHOP_INVENTORY.find(si => si.name === item.name);
    if (shopItem) {
      return Math.floor(shopItem.goldCost / 2);
    }
    switch (item.rarity?.toLowerCase()) {
      case "common": return 5;
      case "uncommon": return 25;
      case "rare": return 100;
      case "very rare": return 500;
      case "legendary": return 2500;
      default: return 1;
    }
  };

  const getRepairCost = (item: InventoryItem | null) => {
    if (!item) return { gold: 0, silver: 0 };
    return REPAIR_COSTS[item.rarity?.toLowerCase() || "common"] || REPAIR_COSTS.common;
  };

  const needsRepair = (item: InventoryItem) => {
    if (item.durability === undefined || item.maxDurability === undefined) return false;
    return item.durability < item.maxDurability;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center gap-3 mb-4">
            <Beer className="h-10 w-10 text-amber-600" />
            <h1 className="text-4xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
              The Wanderer's Rest
            </h1>
            <Beer className="h-10 w-10 text-amber-600" />
          </div>
          <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            A cozy tavern where adventurers gather between quests. Rest, resupply, repair your gear, and prepare for your next adventure.
          </p>
        </div>

        {characters.length > 1 && (
          <div className="mb-6 flex items-center justify-center gap-4">
            <span className="text-sm text-slate-600 dark:text-slate-400">Select Character:</span>
            <Select 
              value={selectedCharacter?.toString() || activeCharacter?.id?.toString()} 
              onValueChange={(v) => setSelectedCharacter(parseInt(v))}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select a character" />
              </SelectTrigger>
              <SelectContent>
                {characters.map((char: any) => (
                  <SelectItem key={char.id} value={char.id.toString()}>
                    {char.name} (Lv. {char.level})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {activeCharacter && (
          <Card className="mb-6 bg-gradient-to-r from-amber-100 to-orange-100 dark:from-slate-800 dark:to-slate-700 border-amber-300 dark:border-slate-600">
            <CardContent className="py-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-amber-200 dark:bg-slate-600 flex items-center justify-center">
                    <Users className="h-6 w-6 text-amber-700 dark:text-amber-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">{activeCharacter.name}</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Level {activeCharacter.level} {activeCharacter.race} {activeCharacter.class}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <Coins className="h-5 w-5 text-yellow-600" />
                    <span className="font-bold text-yellow-700 dark:text-yellow-400">{characterGold} gp</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Coins className="h-5 w-5 text-slate-400" />
                    <span className="font-bold text-slate-600 dark:text-slate-400">{characterSilver} sp</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Heart className="h-5 w-5 text-red-500" />
                    <span className="font-bold">
                      {activeCharacter.currentHp || activeCharacter.maxHp}/{activeCharacter.maxHp} HP
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="shop" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="shop" className="flex items-center gap-2">
              <ShoppingBag className="h-4 w-4" />
              <span className="hidden sm:inline">Shop</span>
            </TabsTrigger>
            <TabsTrigger value="inventory" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              <span className="hidden sm:inline">Inventory</span>
            </TabsTrigger>
            <TabsTrigger value="repair" className="flex items-center gap-2">
              <Wrench className="h-4 w-4" />
              <span className="hidden sm:inline">Repair</span>
            </TabsTrigger>
            <TabsTrigger value="social" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Tavern</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="shop">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingBag className="h-5 w-5" />
                  General Store
                </CardTitle>
                <CardDescription>
                  Browse weapons, armor, potions, and adventuring supplies
                </CardDescription>
                <div className="flex flex-wrap gap-2 mt-4">
                  <Button 
                    variant={shopCategory === "all" ? "default" : "outline"} 
                    size="sm"
                    onClick={() => setShopCategory("all")}
                  >
                    All
                  </Button>
                  <Button 
                    variant={shopCategory === "weapons" ? "default" : "outline"} 
                    size="sm"
                    onClick={() => setShopCategory("weapons")}
                  >
                    <Sword className="h-4 w-4 mr-1" /> Weapons
                  </Button>
                  <Button 
                    variant={shopCategory === "armor" ? "default" : "outline"} 
                    size="sm"
                    onClick={() => setShopCategory("armor")}
                  >
                    <Shield className="h-4 w-4 mr-1" /> Armor
                  </Button>
                  <Button 
                    variant={shopCategory === "potions" ? "default" : "outline"} 
                    size="sm"
                    onClick={() => setShopCategory("potions")}
                  >
                    <Sparkles className="h-4 w-4 mr-1" /> Potions
                  </Button>
                  <Button 
                    variant={shopCategory === "tools" ? "default" : "outline"} 
                    size="sm"
                    onClick={() => setShopCategory("tools")}
                  >
                    Tools
                  </Button>
                  <Button 
                    variant={shopCategory === "misc" ? "default" : "outline"} 
                    size="sm"
                    onClick={() => setShopCategory("misc")}
                  >
                    Misc
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {filteredShopItems.map((item) => (
                      <Card 
                        key={item.id} 
                        className={`cursor-pointer transition-all hover:shadow-lg ${
                          !canAfford(item) ? 'opacity-60' : ''
                        }`}
                        onClick={() => {
                          if (activeCharacter) {
                            setSelectedShopItem(item);
                            setQuantity(1);
                            setBuyDialogOpen(true);
                          }
                        }}
                      >
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="font-bold">{item.name}</h4>
                            <Badge variant={getRarityBadgeVariant(item.rarity)} className={getRarityColor(item.rarity)}>
                              {item.rarity}
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-xs text-slate-500">{item.type}</p>
                            <div className="flex items-center gap-1 text-xs text-slate-500">
                              <Weight className="h-3 w-3" />
                              <span>{item.weight} lbs</span>
                            </div>
                          </div>
                          <p className="text-sm text-slate-600 dark:text-slate-400 mb-3 line-clamp-2">
                            {item.description}
                          </p>
                          {item.damage && (
                            <div className="flex items-center gap-1 text-sm text-red-600 dark:text-red-400 mb-1">
                              <Sword className="h-3 w-3" />
                              <span>{item.damage}</span>
                            </div>
                          )}
                          {item.armor && (
                            <div className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 mb-1">
                              <Shield className="h-3 w-3" />
                              <span>AC {item.armor}</span>
                            </div>
                          )}
                          {item.properties && (
                            <p className="text-xs text-slate-500 italic mb-2">{item.properties}</p>
                          )}
                          <Separator className="my-2" />
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1">
                              <Coins className="h-4 w-4 text-yellow-600" />
                              <span className="font-bold text-yellow-700 dark:text-yellow-400">
                                {item.goldCost} gp
                                {item.silverCost ? ` ${item.silverCost} sp` : ''}
                              </span>
                            </div>
                            {canAfford(item) ? (
                              <Check className="h-4 w-4 text-green-500" />
                            ) : (
                              <X className="h-4 w-4 text-red-500" />
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="inventory">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Your Inventory
                </CardTitle>
                <CardDescription>
                  View your items and sell unwanted equipment
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Encumbrance Bar */}
                {activeCharacter && (
                  <div className="mb-6 p-4 rounded-lg bg-slate-100 dark:bg-slate-800 border">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Weight className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                        <span className="font-medium text-sm">Carrying Capacity</span>
                      </div>
                      <span className={`text-sm font-bold ${isOverburdened ? 'text-red-600' : isEncumbered ? 'text-orange-600' : 'text-green-600'}`}>
                        {totalInventoryWeight.toFixed(1)} / {carryingCapacity} lbs
                      </span>
                    </div>
                    <div className="w-full h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all ${
                          isOverburdened ? 'bg-red-500' : 
                          isEncumbered ? 'bg-orange-500' : 
                          encumbrancePercent > 50 ? 'bg-yellow-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${encumbrancePercent}%` }}
                      />
                    </div>
                    <div className="flex justify-between mt-1 text-xs text-slate-500">
                      <span>STR {characterStrength} × 15 lbs</span>
                      <span>{encumbrancePercent.toFixed(0)}% full</span>
                    </div>
                    
                    {/* Overburdened Warning */}
                    {isOverburdened && (
                      <div className="mt-3 p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="font-medium text-red-700 dark:text-red-400">You are overburdened!</p>
                            <p className="text-sm text-red-600 dark:text-red-400/80">
                              Your movement speed is reduced to 0. Sell some items below to lighten your load.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Encumbered Warning */}
                    {isEncumbered && !isOverburdened && (
                      <div className="mt-3 p-3 bg-orange-100 dark:bg-orange-900/30 border border-orange-300 dark:border-orange-700 rounded-lg">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="font-medium text-orange-700 dark:text-orange-400">You are encumbered</p>
                            <p className="text-sm text-orange-600 dark:text-orange-400/80">
                              Your movement speed is reduced by 10 ft. Consider selling some items.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {characterEquipment.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Your inventory is empty.</p>
                    <p className="text-sm">Visit the shop to buy some gear!</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[500px]">
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {characterEquipment.map((item, index) => (
                        <Card key={index} className={item.equipped ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/20' : ''}>
                          <CardContent className="p-4">
                            <div className="flex justify-between items-start mb-2">
                              <h4 className="font-bold flex items-center gap-2">
                                {typeof item === 'string' ? item : item.name}
                                {item.equipped && <Star className="h-4 w-4 text-amber-500" />}
                              </h4>
                              {typeof item !== 'string' && item.rarity && (
                                <Badge variant={getRarityBadgeVariant(item.rarity)} className={getRarityColor(item.rarity)}>
                                  {item.rarity}
                                </Badge>
                              )}
                            </div>
                            {typeof item !== 'string' && (
                              <>
                                <div className="flex items-center justify-between mb-2">
                                  <p className="text-xs text-slate-500">{item.type}</p>
                                  <div className="flex items-center gap-1 text-xs text-slate-500">
                                    <Weight className="h-3 w-3" />
                                    <span>{getItemWeight(item)} lbs</span>
                                  </div>
                                </div>
                                {item.description && (
                                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-2 line-clamp-2">
                                    {item.description}
                                  </p>
                                )}
                                {item.damage && (
                                  <div className="flex items-center gap-1 text-sm text-red-600 dark:text-red-400 mb-1">
                                    <Sword className="h-3 w-3" />
                                    <span>{item.damage}</span>
                                  </div>
                                )}
                                {item.armor && (
                                  <div className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 mb-1">
                                    <Shield className="h-3 w-3" />
                                    <span>AC +{item.armor}</span>
                                  </div>
                                )}
                                {item.properties && (
                                  <p className="text-xs text-slate-500 dark:text-slate-400 italic mb-1">
                                    {item.properties}
                                  </p>
                                )}
                                {item.durability !== undefined && (
                                  <div className="space-y-1 mb-2">
                                    <div className="flex items-center justify-between text-xs">
                                      <span className="flex items-center gap-1">
                                        <Wrench className="h-3 w-3" />
                                        Durability
                                      </span>
                                      <span className={`font-medium ${
                                        item.durability <= 0 ? 'text-red-600' :
                                        item.durability < (item.maxDurability || 100) * 0.3 ? 'text-red-500' :
                                        item.durability < (item.maxDurability || 100) * 0.6 ? 'text-orange-500' :
                                        'text-green-600'
                                      }`}>
                                        {item.durability}/{item.maxDurability || 100}
                                      </span>
                                    </div>
                                    <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                      <div 
                                        className={`h-full transition-all ${
                                          item.durability <= 0 ? 'bg-red-600' :
                                          item.durability < (item.maxDurability || 100) * 0.3 ? 'bg-red-500' :
                                          item.durability < (item.maxDurability || 100) * 0.6 ? 'bg-orange-500' :
                                          'bg-green-500'
                                        }`}
                                        style={{ width: `${Math.max(0, (item.durability / (item.maxDurability || 100)) * 100)}%` }}
                                      />
                                    </div>
                                    {item.durability <= 0 && (
                                      <div className="flex items-center gap-1 text-xs text-red-600 font-medium">
                                        <AlertTriangle className="h-3 w-3" />
                                        Broken! Visit blacksmith to repair.
                                      </div>
                                    )}
                                    {item.durability > 0 && item.durability <= 20 && (
                                      <div className="flex items-center gap-1 text-xs text-orange-600 font-medium">
                                        <AlertCircle className="h-3 w-3" />
                                        Needs repair soon!
                                      </div>
                                    )}
                                  </div>
                                )}
                              </>
                            )}
                            <Separator className="my-2" />
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1">
                                <Coins className="h-4 w-4 text-yellow-600" />
                                <span className="text-sm text-slate-600 dark:text-slate-400">
                                  Sell: {getSellPrice(typeof item === 'string' ? { name: item, rarity: 'common', type: 'misc', description: '' } : item)} gp
                                </span>
                              </div>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => {
                                  setSelectedInventoryItem(typeof item === 'string' ? { name: item, rarity: 'common', type: 'misc', description: '' } : item);
                                  setSellDialogOpen(true);
                                }}
                              >
                                Sell
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="repair">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wrench className="h-5 w-5" />
                  Blacksmith's Forge
                </CardTitle>
                <CardDescription>
                  Repair damaged weapons and armor
                </CardDescription>
              </CardHeader>
              <CardContent>
                {characterEquipment.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    <Wrench className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No items to repair.</p>
                    <p className="text-sm">Your inventory is empty.</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[500px]">
                    <div className="space-y-4">
                      {characterEquipment.filter(item => typeof item !== 'string').map((item, index) => {
                        const invItem = item as InventoryItem;
                        const repairCost = getRepairCost(invItem);
                        const damaged = needsRepair(invItem);
                        
                        return (
                          <Card key={index} className={damaged ? 'border-orange-400' : ''}>
                            <CardContent className="p-4 flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                <div className={`p-2 rounded-full ${damaged ? 'bg-orange-100 dark:bg-orange-900' : 'bg-green-100 dark:bg-green-900'}`}>
                                  {damaged ? (
                                    <AlertCircle className="h-5 w-5 text-orange-600" />
                                  ) : (
                                    <Check className="h-5 w-5 text-green-600" />
                                  )}
                                </div>
                                <div>
                                  <h4 className="font-bold">{invItem.name}</h4>
                                  <p className="text-sm text-slate-500">{invItem.type}</p>
                                  {invItem.durability !== undefined && (
                                    <div className="flex items-center gap-2 mt-1">
                                      <div className="w-32 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                        <div 
                                          className={`h-full transition-all ${
                                            invItem.durability < (invItem.maxDurability || 100) * 0.3 
                                              ? 'bg-red-500' 
                                              : invItem.durability < (invItem.maxDurability || 100) * 0.6 
                                                ? 'bg-orange-500' 
                                                : 'bg-green-500'
                                          }`}
                                          style={{ width: `${(invItem.durability / (invItem.maxDurability || 100)) * 100}%` }}
                                        />
                                      </div>
                                      <span className="text-xs text-slate-500">
                                        {invItem.durability}/{invItem.maxDurability || 100}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-4">
                                <div className="text-right">
                                  <p className="text-sm text-slate-500">Repair Cost</p>
                                  <p className="font-bold flex items-center gap-1">
                                    <Coins className="h-4 w-4 text-yellow-600" />
                                    {repairCost.gold} gp
                                  </p>
                                </div>
                                <Button 
                                  disabled={!damaged || characterGold < repairCost.gold}
                                  onClick={() => {
                                    setSelectedInventoryItem(invItem);
                                    setRepairDialogOpen(true);
                                  }}
                                >
                                  <RefreshCw className="h-4 w-4 mr-2" />
                                  Repair
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="social">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Beer className="h-5 w-5" />
                  Common Room
                </CardTitle>
                <CardDescription>
                  Mingle with fellow adventurers and hear the latest rumors
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Tavern Sub-tabs */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <button
                    onClick={() => setTavernTab('drinks')}
                    className={`p-4 text-center rounded-lg border-2 transition-all ${tavernTab === 'drinks' ? 'bg-amber-100 dark:bg-amber-900/30 border-amber-500' : 'bg-slate-50 dark:bg-slate-800 border-transparent hover:border-amber-300'}`}
                  >
                    <Beer className="h-8 w-8 mx-auto mb-2 text-amber-600" />
                    <p className="text-sm font-medium">Order Drinks</p>
                  </button>
                  <button
                    onClick={() => setTavernTab('party')}
                    className={`p-4 text-center rounded-lg border-2 transition-all ${tavernTab === 'party' ? 'bg-amber-100 dark:bg-amber-900/30 border-amber-500' : 'bg-slate-50 dark:bg-slate-800 border-transparent hover:border-amber-300'}`}
                  >
                    <Users className="h-8 w-8 mx-auto mb-2 text-amber-600" />
                    <p className="text-sm font-medium">Find Party</p>
                  </button>
                  <button
                    onClick={() => setTavernTab('rumors')}
                    className={`p-4 text-center rounded-lg border-2 transition-all ${tavernTab === 'rumors' ? 'bg-amber-100 dark:bg-amber-900/30 border-amber-500' : 'bg-slate-50 dark:bg-slate-800 border-transparent hover:border-amber-300'}`}
                  >
                    <Sparkles className="h-8 w-8 mx-auto mb-2 text-amber-600" />
                    <p className="text-sm font-medium">Hear Rumors</p>
                  </button>
                  <button
                    onClick={() => setTavernTab('games')}
                    className={`p-4 text-center rounded-lg border-2 transition-all ${tavernTab === 'games' ? 'bg-amber-100 dark:bg-amber-900/30 border-amber-500' : 'bg-slate-50 dark:bg-slate-800 border-transparent hover:border-amber-300'}`}
                  >
                    <Zap className="h-8 w-8 mx-auto mb-2 text-amber-600" />
                    <p className="text-sm font-medium">Mini-Games</p>
                  </button>
                </div>
                
                <Separator className="my-4" />
                
                {/* Order Drinks Tab */}
                {tavernTab === 'drinks' && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      <Beer className="h-5 w-5 text-amber-600" />
                      The Bartender's Menu
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {TAVERN_DRINKS.map(drink => (
                        <Card key={drink.id} className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-slate-800 dark:to-slate-900 border-amber-200 dark:border-amber-800/50">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="text-2xl">{drink.icon}</span>
                                <h4 className="font-bold text-amber-900 dark:text-amber-100">{drink.name}</h4>
                              </div>
                              <Badge variant="outline" className="text-amber-600">
                                <Coins className="h-3 w-3 mr-1" />
                                {drink.cost} gp
                              </Badge>
                            </div>
                            <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">{drink.description}</p>
                            <p className="text-xs text-amber-700 dark:text-amber-400 italic mb-3">Effect: {drink.effect}</p>
                            <Button 
                              size="sm" 
                              className="w-full"
                              disabled={!activeCharacter || characterGold < drink.cost || buyDrinkMutation.isPending}
                              onClick={() => activeCharacter && buyDrinkMutation.mutate({ characterId: activeCharacter.id, drink })}
                            >
                              {buyDrinkMutation.isPending ? "Ordering..." : "Order Drink"}
                            </Button>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                    {lastDrinkPurchased && (
                      <Card className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 mt-4">
                        <CardContent className="p-4 flex items-center gap-3">
                          <span className="text-3xl">{lastDrinkPurchased.icon}</span>
                          <div>
                            <p className="font-medium text-green-800 dark:text-green-200">You're enjoying a {lastDrinkPurchased.name}!</p>
                            <p className="text-sm text-green-600 dark:text-green-400">{lastDrinkPurchased.effect}</p>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}
                
                {/* Find Party Tab */}
                {tavernTab === 'party' && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      <Users className="h-5 w-5 text-amber-600" />
                      Find Adventuring Companions
                    </h3>
                    
                    {/* Post to Bulletin Board CTA */}
                    <Card className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-amber-200 dark:border-amber-700/50">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                              <Scroll className="h-5 w-5 text-white" />
                            </div>
                            <div>
                              <p className="font-semibold text-amber-800 dark:text-amber-300">Looking for a party?</p>
                              <p className="text-sm text-amber-600 dark:text-amber-400">Post on the Bulletin Board to find other adventurers</p>
                            </div>
                          </div>
                          <Link href="/bulletin">
                            <Button className="bg-amber-600 hover:bg-amber-700 text-white">
                              <PenLine className="h-4 w-4 mr-2" />
                              Post LFG
                            </Button>
                          </Link>
                        </div>
                      </CardContent>
                    </Card>
                    
                    {/* Recent LFG Posts */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-muted-foreground flex items-center gap-2">
                          <MessageSquare className="h-4 w-4" />
                          Recent Party Requests
                        </h4>
                        <Link href="/bulletin">
                          <Button variant="ghost" size="sm" className="text-amber-600">
                            View All <ChevronRight className="h-4 w-4 ml-1" />
                          </Button>
                        </Link>
                      </div>
                      
                      <RecentBulletinPosts />
                    </div>
                    
                    {/* Gold Transfer Section - moved to secondary */}
                    {characters.length > 1 && activeCharacter && (
                      <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                        <h4 className="font-medium text-muted-foreground mb-3 flex items-center gap-2">
                          <Coins className="h-4 w-4" />
                          Transfer Gold Between Your Characters
                        </h4>
                        <Card className="bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 border-yellow-200 dark:border-yellow-800/50">
                          <CardContent className="p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Coins className="h-6 w-6 text-yellow-600" />
                              <div>
                                <p className="text-sm text-muted-foreground">Your Gold</p>
                                <p className="text-xl font-bold text-yellow-700 dark:text-yellow-400">{characterGold} gp</p>
                              </div>
                            </div>
                            <Button 
                              variant="outline" 
                              onClick={() => setGoldTransferOpen(true)}
                              disabled={characterGold < 1}
                            >
                              <Coins className="h-4 w-4 mr-2" />
                              Send Gold
                            </Button>
                          </CardContent>
                        </Card>
                      </div>
                    )}
                  </div>
                )}
                
                {/* Hear Rumors Tab */}
                {tavernTab === 'rumors' && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-amber-600" />
                      Whispers in the Common Room
                    </h3>
                    <Card className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-slate-800 dark:to-purple-900/20 border-purple-200 dark:border-purple-800/50">
                      <CardContent className="p-6">
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                            <Users className="h-6 w-6 text-white" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm text-purple-600 dark:text-purple-400 font-medium mb-1">{rumorNPC} leans in and whispers:</p>
                            <p className="text-lg italic text-slate-700 dark:text-slate-200">"{currentRumor}"</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <div className="flex justify-center">
                      <Button onClick={hearNewRumor} variant="outline" className="gap-2">
                        <RefreshCw className="h-4 w-4" />
                        Listen for Another Rumor
                      </Button>
                    </div>
                    <p className="text-center text-sm text-muted-foreground">
                      Rumors may lead to adventure hooks and quest opportunities!
                    </p>
                  </div>
                )}
                
                {/* Mini-Games Tab - Liar's Dice */}
                {tavernTab === 'games' && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      <Zap className="h-5 w-5 text-amber-600" />
                      Liar's Dice
                    </h3>
                    <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-slate-800 dark:to-emerald-900/20 border-green-200 dark:border-green-800/50">
                      <CardContent className="p-6">
                        {diceGame.gamePhase === 'betting' && (
                          <div className="space-y-4 text-center">
                            <p className="text-muted-foreground">Place your bet and try to guess how many dice of a certain face are on the table!</p>
                            <div className="flex items-center justify-center gap-4">
                              <span>Bet:</span>
                              <Input 
                                type="number"
                                min={1}
                                max={Math.min(100, characterGold)}
                                value={diceGame.playerBet}
                                onChange={(e) => setDiceGame(prev => ({ ...prev, playerBet: Math.max(1, parseInt(e.target.value) || 1) }))}
                                className="w-20"
                              />
                              <span className="text-yellow-600">gp</span>
                            </div>
                            <p className="text-sm text-muted-foreground">Your gold: {characterGold} gp</p>
                            <Button 
                              onClick={startDiceGame}
                              disabled={!activeCharacter || characterGold < diceGame.playerBet}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              Roll the Dice!
                            </Button>
                          </div>
                        )}
                        
                        {diceGame.gamePhase === 'guessing' && (
                          <div className="space-y-4">
                            <div className="text-center">
                              <p className="font-medium mb-2">Your Dice:</p>
                              <div className="flex justify-center gap-2 mb-4">
                                {diceGame.playerDice.map((die, i) => (
                                  <div key={i} className="w-10 h-10 bg-white dark:bg-slate-700 rounded-lg flex items-center justify-center text-xl font-bold border-2 border-amber-300">
                                    {['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'][die - 1]}
                                  </div>
                                ))}
                              </div>
                              <p className="text-sm text-muted-foreground mb-4">The house has 5 hidden dice. Guess how many dice total show a certain face (1s are wild)!</p>
                            </div>
                            <div className="flex items-center justify-center gap-4 flex-wrap">
                              <div className="flex items-center gap-2">
                                <span>I bet there are at least</span>
                                <Select value={diceGame.playerGuess.count.toString()} onValueChange={(v) => setDiceGame(prev => ({ ...prev, playerGuess: { ...prev.playerGuess, count: parseInt(v) } }))}>
                                  <SelectTrigger className="w-16"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    {[1,2,3,4,5,6,7,8,9,10].map(n => <SelectItem key={n} value={n.toString()}>{n}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                                <span>dice showing</span>
                                <Select value={diceGame.playerGuess.face.toString()} onValueChange={(v) => setDiceGame(prev => ({ ...prev, playerGuess: { ...prev.playerGuess, face: parseInt(v) } }))}>
                                  <SelectTrigger className="w-16"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    {[2,3,4,5,6].map(n => <SelectItem key={n} value={n.toString()}>{['⚁', '⚂', '⚃', '⚄', '⚅'][n - 2]}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            <div className="flex justify-center mt-4">
                              <Button onClick={makeGuess} className="bg-amber-600 hover:bg-amber-700">Make My Guess!</Button>
                            </div>
                          </div>
                        )}
                        
                        {diceGame.gamePhase === 'result' && (
                          <div className="space-y-4 text-center">
                            <div className={`text-2xl font-bold ${diceGame.result === 'win' ? 'text-green-600' : 'text-red-600'}`}>
                              {diceGame.result === 'win' ? '🎉 You Win!' : '💔 You Lose!'}
                            </div>
                            <div>
                              <p className="mb-2">Your Dice:</p>
                              <div className="flex justify-center gap-2 mb-2">
                                {diceGame.playerDice.map((die, i) => (
                                  <div key={i} className="w-8 h-8 bg-white dark:bg-slate-700 rounded flex items-center justify-center font-bold border">
                                    {['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'][die - 1]}
                                  </div>
                                ))}
                              </div>
                              <p className="mb-2">House Dice:</p>
                              <div className="flex justify-center gap-2 mb-4">
                                {diceGame.houseDice.map((die, i) => (
                                  <div key={i} className="w-8 h-8 bg-red-100 dark:bg-red-900/30 rounded flex items-center justify-center font-bold border border-red-300">
                                    {['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'][die - 1]}
                                  </div>
                                ))}
                              </div>
                            </div>
                            <p className="text-lg">
                              {diceGame.result === 'win' 
                                ? <span className="text-green-600">+{diceGame.winnings} gold!</span>
                                : <span className="text-red-600">{diceGame.winnings} gold</span>
                              }
                            </p>
                            <Button onClick={resetDiceGame} variant="outline">Play Again</Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={buyDialogOpen} onOpenChange={setBuyDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Purchase {selectedShopItem?.name}</DialogTitle>
              <DialogDescription>
                {selectedShopItem?.description}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {selectedShopItem?.damage && (
                <div className="flex items-center gap-2">
                  <Sword className="h-4 w-4 text-red-500" />
                  <span>Damage: {selectedShopItem.damage}</span>
                </div>
              )}
              {selectedShopItem?.armor && (
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-blue-500" />
                  <span>AC: {selectedShopItem.armor}</span>
                </div>
              )}
              <div className="flex items-center gap-4">
                <span>Quantity:</span>
                <Input 
                  type="number" 
                  min={1} 
                  max={99}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-20"
                />
              </div>
              <div className="flex items-center justify-between bg-slate-100 dark:bg-slate-800 p-3 rounded-lg">
                <span>Total Cost:</span>
                <span className="font-bold flex items-center gap-2">
                  <Coins className="h-4 w-4 text-yellow-600" />
                  {(selectedShopItem?.goldCost || 0) * quantity} gp
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Your Gold:</span>
                <span className={`font-bold ${canAfford(selectedShopItem, quantity) ? 'text-green-600' : 'text-red-600'}`}>
                  {characterGold} gp
                </span>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setBuyDialogOpen(false)}>Cancel</Button>
              <Button 
                disabled={!canAfford(selectedShopItem, quantity) || buyItemMutation.isPending}
                onClick={() => {
                  if (activeCharacter && selectedShopItem) {
                    buyItemMutation.mutate({
                      characterId: activeCharacter.id,
                      item: selectedShopItem,
                      qty: quantity
                    });
                  }
                }}
              >
                {buyItemMutation.isPending ? "Purchasing..." : "Buy"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={sellDialogOpen} onOpenChange={setSellDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Sell {selectedInventoryItem?.name}</DialogTitle>
              <DialogDescription>
                Are you sure you want to sell this item?
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-slate-100 dark:bg-slate-800 p-3 rounded-lg">
                <span>You will receive:</span>
                <span className="font-bold flex items-center gap-2 text-green-600">
                  <Coins className="h-4 w-4 text-yellow-600" />
                  +{getSellPrice(selectedInventoryItem)} gp
                </span>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSellDialogOpen(false)}>Cancel</Button>
              <Button 
                variant="destructive"
                disabled={sellItemMutation.isPending}
                onClick={() => {
                  if (activeCharacter && selectedInventoryItem) {
                    sellItemMutation.mutate({
                      characterId: activeCharacter.id,
                      itemName: selectedInventoryItem.name
                    });
                  }
                }}
              >
                {sellItemMutation.isPending ? "Selling..." : "Sell Item"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={repairDialogOpen} onOpenChange={setRepairDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Repair {selectedInventoryItem?.name}</DialogTitle>
              <DialogDescription>
                The blacksmith will restore your item to full durability.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-slate-100 dark:bg-slate-800 p-3 rounded-lg">
                <span>Repair Cost:</span>
                <span className="font-bold flex items-center gap-2">
                  <Coins className="h-4 w-4 text-yellow-600" />
                  {getRepairCost(selectedInventoryItem).gold} gp
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Your Gold:</span>
                <span className={`font-bold ${characterGold >= getRepairCost(selectedInventoryItem).gold ? 'text-green-600' : 'text-red-600'}`}>
                  {characterGold} gp
                </span>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRepairDialogOpen(false)}>Cancel</Button>
              <Button 
                disabled={characterGold < getRepairCost(selectedInventoryItem).gold || repairItemMutation.isPending}
                onClick={() => {
                  if (activeCharacter && selectedInventoryItem) {
                    repairItemMutation.mutate({
                      characterId: activeCharacter.id,
                      itemName: selectedInventoryItem.name
                    });
                  }
                }}
              >
                {repairItemMutation.isPending ? "Repairing..." : "Repair"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Gold Transfer Dialog */}
        <Dialog open={goldTransferOpen} onOpenChange={(open) => {
          setGoldTransferOpen(open);
          if (!open) {
            setTransferRecipient(null);
            setTransferAmount(1);
          }
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Coins className="h-5 w-5 text-yellow-600" />
                Send Gold
              </DialogTitle>
              <DialogDescription>
                Share your wealth with another adventurer.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Recipient</label>
                <Select 
                  value={transferRecipient?.toString() || ""} 
                  onValueChange={(val) => setTransferRecipient(parseInt(val))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a character" />
                  </SelectTrigger>
                  <SelectContent>
                    {characters.filter(c => c.id !== activeCharacter?.id).map(char => (
                      <SelectItem key={char.id} value={char.id.toString()}>
                        {char.name} (Level {char.level} {char.class})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Amount (gp)</label>
                <Input 
                  type="number"
                  min={1}
                  max={characterGold}
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(Math.max(1, Math.min(characterGold, parseInt(e.target.value) || 1)))}
                />
              </div>
              <div className="flex items-center justify-between bg-slate-100 dark:bg-slate-800 p-3 rounded-lg">
                <span>Your remaining gold:</span>
                <span className={`font-bold ${characterGold - transferAmount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {Math.max(0, characterGold - transferAmount)} gp
                </span>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setGoldTransferOpen(false)}>Cancel</Button>
              <Button 
                disabled={!transferRecipient || transferAmount < 1 || transferAmount > characterGold || transferGoldMutation.isPending}
                onClick={() => {
                  if (activeCharacter && transferRecipient) {
                    transferGoldMutation.mutate({
                      senderId: activeCharacter.id,
                      recipientId: transferRecipient,
                      amount: transferAmount
                    });
                  }
                }}
              >
                {transferGoldMutation.isPending ? "Sending..." : "Send Gold"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
