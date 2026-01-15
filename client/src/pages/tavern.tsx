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
  X
} from "lucide-react";
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
    category: "potions"
  },
  {
    id: "thieves-tools",
    name: "Thieves' Tools",
    type: "Tools",
    rarity: "common",
    description: "Lockpicks and small tools for disabling traps and opening locks.",
    goldCost: 25,
    category: "tools"
  },
  {
    id: "rope-hemp",
    name: "Rope (50 ft, Hemp)",
    type: "Adventuring Gear",
    rarity: "common",
    description: "Strong rope for climbing, binding, or other uses.",
    goldCost: 1,
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/characters"] });
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
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/characters"] });
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
                          <p className="text-xs text-slate-500 mb-2">{item.type}</p>
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
                                <p className="text-xs text-slate-500 mb-2">{item.type}</p>
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
                                  <div className="flex items-center gap-1 text-sm mb-1">
                                    <Wrench className="h-3 w-3" />
                                    <span className={item.durability < (item.maxDurability || 100) * 0.3 ? 'text-red-500' : ''}>
                                      Durability: {item.durability}/{item.maxDurability || 100}
                                    </span>
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
                <div className="text-center py-12">
                  <Users className="h-16 w-16 mx-auto mb-4 text-amber-600 opacity-50" />
                  <h3 className="text-xl font-bold mb-2">Coming Soon!</h3>
                  <p className="text-slate-600 dark:text-slate-400 max-w-md mx-auto">
                    The tavern's common room will soon be bustling with activity. Chat with other players, 
                    share stories from your adventures, and find new party members.
                  </p>
                  <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto">
                    <Card className="p-4 text-center bg-amber-50 dark:bg-slate-800">
                      <Beer className="h-8 w-8 mx-auto mb-2 text-amber-600" />
                      <p className="text-sm font-medium">Order Drinks</p>
                    </Card>
                    <Card className="p-4 text-center bg-amber-50 dark:bg-slate-800">
                      <Users className="h-8 w-8 mx-auto mb-2 text-amber-600" />
                      <p className="text-sm font-medium">Find Party</p>
                    </Card>
                    <Card className="p-4 text-center bg-amber-50 dark:bg-slate-800">
                      <Sparkles className="h-8 w-8 mx-auto mb-2 text-amber-600" />
                      <p className="text-sm font-medium">Hear Rumors</p>
                    </Card>
                    <Card className="p-4 text-center bg-amber-50 dark:bg-slate-800">
                      <Zap className="h-8 w-8 mx-auto mb-2 text-amber-600" />
                      <p className="text-sm font-medium">Mini-Games</p>
                    </Card>
                  </div>
                </div>
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
      </div>
    </div>
  );
}
