import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, Package, Sword, Shield, Wand2, ScrollText } from "lucide-react";

const itemTypes = [
  { value: "weapon", label: "Weapon", icon: Sword },
  { value: "armor", label: "Armor", icon: Shield },
  { value: "shield", label: "Shield", icon: Shield },
  { value: "potion", label: "Potion", icon: Package },
  { value: "scroll", label: "Scroll", icon: ScrollText },
  { value: "wand", label: "Wand", icon: Wand2 },
  { value: "ring", label: "Ring", icon: Package },
  { value: "wondrous", label: "Wondrous Item", icon: Sparkles },
  { value: "tool", label: "Tool", icon: Package },
  { value: "gear", label: "Gear", icon: Package }
];

const rarityLevels = [
  { value: "common", label: "Common", color: "bg-gray-500" },
  { value: "uncommon", label: "Uncommon", color: "bg-green-500" },
  { value: "rare", label: "Rare", color: "bg-blue-500" },
  { value: "very_rare", label: "Very Rare", color: "bg-purple-500" },
  { value: "legendary", label: "Legendary", color: "bg-orange-500" },
  { value: "artifact", label: "Artifact", color: "bg-red-500" }
];

const equipmentSlots = [
  "none", "main_hand", "off_hand", "both_hands", "head", "neck", 
  "back", "body", "wrists", "hands", "finger", "waist", "legs", "feet"
];

interface ItemForm {
  name: string;
  description: string;
  itemType: string;
  rarity: string;
  slot: string;
  weight: number;
  value: number;
  isStackable: boolean;
  isConsumable: boolean;
  requiresAttunement: boolean;
  properties: any;
}

export default function ItemCreatorTab() {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [itemForm, setItemForm] = useState<ItemForm>({
    name: "",
    description: "",
    itemType: "weapon",
    rarity: "common",
    slot: "none",
    weight: 0,
    value: 0,
    isStackable: false,
    isConsumable: false,
    requiresAttunement: false,
    properties: {}
  });

  // Fetch user's custom items
  const { data: userItems = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/items/user"],
    refetchOnWindowFocus: false
  });

  // Create item mutation
  const createItemMutation = useMutation({
    mutationFn: async (itemData: any) => {
      const response = await apiRequest('POST', '/api/items', itemData);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Item Created",
        description: "Your custom item has been created successfully."
      });
      queryClient.invalidateQueries({ queryKey: ["/api/items/user"] });
      setItemForm({
        name: "",
        description: "",
        itemType: "weapon",
        rarity: "common",
        slot: "none",
        weight: 0,
        value: 0,
        isStackable: false,
        isConsumable: false,
        requiresAttunement: false,
        properties: {}
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Create Item",
        description: error.message || "An error occurred while creating the item.",
        variant: "destructive"
      });
    }
  });

  // AI Generate Item mutation
  const generateItemMutation = useMutation({
    mutationFn: async (prompt: string) => {
      const response = await apiRequest('POST', '/api/items/generate', { prompt });
      return await response.json();
    },
    onSuccess: (data) => {
      setItemForm({
        ...itemForm,
        ...data,
        properties: data.properties || {}
      });
      toast({
        title: "Item Generated",
        description: "AI has generated item details. Review and create when ready."
      });
    },
    onError: (error: any) => {
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate item with AI.",
        variant: "destructive"
      });
    }
  });

  const handleGenerateItem = async () => {
    if (!itemForm.name && !itemForm.itemType) {
      toast({
        title: "Missing Information",
        description: "Please provide at least an item name or type for AI generation.",
        variant: "destructive"
      });
      return;
    }

    const prompt = `Create a ${itemForm.rarity} ${itemForm.itemType} ${itemForm.name ? `called "${itemForm.name}"` : ''}. ${itemForm.description || ''}`;
    generateItemMutation.mutate(prompt);
  };

  const handleCreateItem = () => {
    if (!itemForm.name || !itemForm.description) {
      toast({
        title: "Missing Information",
        description: "Please provide at least a name and description.",
        variant: "destructive"
      });
      return;
    }

    createItemMutation.mutate({
      ...itemForm,
      isSystemItem: false
    });
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Item Creation Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Create Custom Item
            </CardTitle>
            <CardDescription>
              Create custom items for your campaigns with AI assistance
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Item Name</Label>
                <Input
                  id="name"
                  value={itemForm.name}
                  onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                  placeholder="Flaming Sword of Justice"
                />
              </div>
              <div>
                <Label htmlFor="itemType">Type</Label>
                <Select value={itemForm.itemType} onValueChange={(value) => setItemForm({ ...itemForm, itemType: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {itemTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        <div className="flex items-center gap-2">
                          <type.icon className="h-4 w-4" />
                          {type.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={itemForm.description}
                onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
                placeholder="A magnificent sword wreathed in eternal flames..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="rarity">Rarity</Label>
                <Select value={itemForm.rarity} onValueChange={(value) => setItemForm({ ...itemForm, rarity: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {rarityLevels.map((rarity) => (
                      <SelectItem key={rarity.value} value={rarity.value}>
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${rarity.color}`} />
                          {rarity.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="slot">Equipment Slot</Label>
                <Select value={itemForm.slot} onValueChange={(value) => setItemForm({ ...itemForm, slot: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {equipmentSlots.map((slot) => (
                      <SelectItem key={slot} value={slot}>
                        {slot.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="value">Value (GP)</Label>
                <Input
                  id="value"
                  type="number"
                  value={itemForm.value}
                  onChange={(e) => setItemForm({ ...itemForm, value: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="stackable"
                  checked={itemForm.isStackable}
                  onCheckedChange={(checked) => setItemForm({ ...itemForm, isStackable: !!checked })}
                />
                <Label htmlFor="stackable">Stackable</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="consumable"
                  checked={itemForm.isConsumable}
                  onCheckedChange={(checked) => setItemForm({ ...itemForm, isConsumable: !!checked })}
                />
                <Label htmlFor="consumable">Consumable</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="attunement"
                  checked={itemForm.requiresAttunement}
                  onCheckedChange={(checked) => setItemForm({ ...itemForm, requiresAttunement: !!checked })}
                />
                <Label htmlFor="attunement">Requires Attunement</Label>
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <Button 
                onClick={handleGenerateItem}
                disabled={generateItemMutation.isPending}
                variant="outline"
                className="flex-1"
              >
                {generateItemMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                Generate with AI
              </Button>
              <Button 
                onClick={handleCreateItem}
                disabled={createItemMutation.isPending}
                className="flex-1"
              >
                {createItemMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Package className="mr-2 h-4 w-4" />
                )}
                Create Item
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* User's Custom Items */}
        <Card>
          <CardHeader>
            <CardTitle>Your Custom Items</CardTitle>
            <CardDescription>
              Items you've created for your campaigns
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : userItems.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No custom items created yet
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {userItems.map((item: any) => (
                  <div key={item.id} className="border rounded-lg p-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold">{item.name}</h4>
                          <Badge 
                            variant="secondary"
                            className={`text-xs ${rarityLevels.find(r => r.value === item.rarity)?.color} text-white`}
                          >
                            {item.rarity}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {item.description}
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span>{item.itemType}</span>
                          <span>{item.value} gp</span>
                          {item.requiresAttunement && <span>Requires Attunement</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}