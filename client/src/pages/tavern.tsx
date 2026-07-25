import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SidebarTabs, SidebarTabsList, SidebarTabsTrigger } from "@/components/ui/sidebar-tabs";
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
  Clock,
  TrendingUp,
  TrendingDown,
  Hammer,
  Anvil,
  FlaskConical,
  Lock
} from "lucide-react";
import { Link } from "wouter";
import { formatDistanceToNow } from "date-fns";
import EngagedCharacterNotice from "@/components/character/EngagedCharacterNotice";
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
  // Consumable fields (potions/scrolls bought from the shop live on character.consumables)
  isConsumable?: boolean;
  quantity?: number;
  // Magical item fields
  isMagical?: boolean;
  magicItemId?: number;
  equipSlot?: string;
  specialEffect?: string;
  requiresAttunement?: boolean;
  isAttuned?: boolean;
}

const SHOP_INVENTORY: ShopItem[] = [
  { id: "club", name: "Club", type: "Simple Melee Weapon", rarity: "common", description: "A stout, heavy piece of wood.", damage: "1d4 bludgeoning", properties: "Light", goldCost: 0, silverCost: 1, weight: 2, category: "weapons" },
  { id: "dagger", name: "Dagger", type: "Simple Melee Weapon", rarity: "common", description: "A small, concealable blade. Light and throwable.", damage: "1d4 piercing", properties: "Finesse, light, thrown (20/60)", goldCost: 2, weight: 1, category: "weapons" },
  { id: "greatclub", name: "Greatclub", type: "Simple Melee Weapon", rarity: "common", description: "A large, heavy bludgeon requiring two hands.", damage: "1d8 bludgeoning", properties: "Two-handed", goldCost: 0, silverCost: 2, weight: 10, category: "weapons" },
  { id: "handaxe", name: "Handaxe", type: "Simple Melee Weapon", rarity: "common", description: "A light axe that can be thrown in a pinch.", damage: "1d6 slashing", properties: "Light, thrown (20/60)", goldCost: 5, weight: 2, category: "weapons" },
  { id: "javelin", name: "Javelin", type: "Simple Melee Weapon", rarity: "common", description: "A light spear designed for throwing.", damage: "1d6 piercing", properties: "Thrown (30/120)", goldCost: 0, silverCost: 5, weight: 2, category: "weapons" },
  { id: "light-hammer", name: "Light Hammer", type: "Simple Melee Weapon", rarity: "common", description: "A small hammer balanced for throwing.", damage: "1d4 bludgeoning", properties: "Light, thrown (20/60)", goldCost: 2, weight: 2, category: "weapons" },
  { id: "mace", name: "Mace", type: "Simple Melee Weapon", rarity: "common", description: "A heavy flanged head atop a sturdy haft.", damage: "1d6 bludgeoning", goldCost: 5, weight: 4, category: "weapons" },
  { id: "quarterstaff", name: "Quarterstaff", type: "Simple Melee Weapon", rarity: "common", description: "A simple wooden staff, versatile and reliable.", damage: "1d6 bludgeoning (versatile 1d8)", goldCost: 0, silverCost: 2, weight: 4, category: "weapons" },
  { id: "sickle", name: "Sickle", type: "Simple Melee Weapon", rarity: "common", description: "A curved blade for harvesting or combat.", damage: "1d4 slashing", properties: "Light", goldCost: 1, weight: 2, category: "weapons" },
  { id: "spear", name: "Spear", type: "Simple Melee Weapon", rarity: "common", description: "A versatile polearm with a pointed tip.", damage: "1d6 piercing (versatile 1d8)", properties: "Thrown (20/60), versatile", goldCost: 1, weight: 3, category: "weapons" },
  { id: "battleaxe", name: "Battleaxe", type: "Martial Melee Weapon", rarity: "common", description: "A heavy axe perfect for cleaving through enemies.", damage: "1d8 slashing (versatile 1d10)", goldCost: 10, weight: 4, category: "weapons" },
  { id: "flail", name: "Flail", type: "Martial Melee Weapon", rarity: "common", description: "A spiked ball on a chain, devastating against shields.", damage: "1d8 bludgeoning", goldCost: 10, weight: 2, category: "weapons" },
  { id: "glaive", name: "Glaive", type: "Martial Melee Weapon", rarity: "common", description: "A long blade on a pole for sweeping attacks.", damage: "1d10 slashing", properties: "Heavy, reach, two-handed", goldCost: 20, weight: 6, category: "weapons" },
  { id: "greataxe", name: "Greataxe", type: "Martial Melee Weapon", rarity: "common", description: "An enormous axe that cleaves through the toughest armor.", damage: "1d12 slashing", properties: "Heavy, two-handed", goldCost: 30, weight: 7, category: "weapons" },
  { id: "longsword", name: "Longsword", type: "Martial Melee Weapon", rarity: "common", description: "A versatile sword favored by warriors and adventurers alike.", damage: "1d8 slashing (versatile 1d10)", goldCost: 15, weight: 3, category: "weapons" },
  { id: "morningstar", name: "Morningstar", type: "Martial Melee Weapon", rarity: "common", description: "A spiked mace that punches through armor.", damage: "1d8 piercing", goldCost: 15, weight: 4, category: "weapons" },
  { id: "pike", name: "Pike", type: "Martial Melee Weapon", rarity: "common", description: "An extremely long spear for holding formations.", damage: "1d10 piercing", properties: "Heavy, reach, two-handed", goldCost: 5, weight: 18, category: "weapons" },
  { id: "rapier", name: "Rapier", type: "Martial Melee Weapon", rarity: "common", description: "A slender, sharply pointed blade for precise thrusts.", damage: "1d8 piercing", properties: "Finesse", goldCost: 25, weight: 2, category: "weapons" },
  { id: "scimitar", name: "Scimitar", type: "Martial Melee Weapon", rarity: "common", description: "A curved blade favored by swashbucklers.", damage: "1d6 slashing", properties: "Finesse, light", goldCost: 25, weight: 3, category: "weapons" },
  { id: "shortsword", name: "Shortsword", type: "Martial Melee Weapon", rarity: "common", description: "A quick, agile blade for close combat.", damage: "1d6 piercing", properties: "Finesse, light", goldCost: 10, weight: 2, category: "weapons" },
  { id: "trident", name: "Trident", type: "Martial Melee Weapon", rarity: "common", description: "A three-pronged spear, thrown or thrust.", damage: "1d6 piercing (versatile 1d8)", properties: "Thrown (20/60), versatile", goldCost: 5, weight: 4, category: "weapons" },
  { id: "war-pick", name: "War Pick", type: "Martial Melee Weapon", rarity: "common", description: "A pointed pick that punches through plate.", damage: "1d8 piercing", goldCost: 5, weight: 2, category: "weapons" },
  { id: "warhammer", name: "Warhammer", type: "Martial Melee Weapon", rarity: "common", description: "A fearsome hammer for crushing armor and bone.", damage: "1d8 bludgeoning (versatile 1d10)", goldCost: 15, weight: 2, category: "weapons" },
  { id: "whip", name: "Whip", type: "Martial Melee Weapon", rarity: "common", description: "A flexible leather lash with surprising reach.", damage: "1d4 slashing", properties: "Finesse, reach", goldCost: 2, weight: 3, category: "weapons" },
  { id: "greatsword", name: "Greatsword", type: "Martial Melee Weapon", rarity: "common", description: "A massive two-handed blade of devastating power.", damage: "2d6 slashing", properties: "Heavy, two-handed", goldCost: 50, weight: 6, category: "weapons" },
  { id: "lance", name: "Lance", type: "Martial Melee Weapon", rarity: "common", description: "A mounted weapon requiring one hand while riding.", damage: "1d12 piercing", properties: "Reach, special (disadvantage within 5 ft)", goldCost: 10, weight: 6, category: "weapons" },
  { id: "maul", name: "Maul", type: "Martial Melee Weapon", rarity: "common", description: "A massive hammer that crushes everything it hits.", damage: "2d6 bludgeoning", properties: "Heavy, two-handed", goldCost: 10, weight: 10, category: "weapons" },
  { id: "shortbow", name: "Shortbow", type: "Simple Ranged Weapon", rarity: "common", description: "A compact bow ideal for quick shots.", damage: "1d6 piercing", properties: "Ammunition (80/320), two-handed", goldCost: 25, weight: 2, category: "weapons" },
  { id: "light-crossbow", name: "Light Crossbow", type: "Simple Ranged Weapon", rarity: "common", description: "A mechanical bow with a trigger mechanism.", damage: "1d8 piercing", properties: "Ammunition (80/320), loading, two-handed", goldCost: 25, weight: 5, category: "weapons" },
  { id: "hand-crossbow", name: "Hand Crossbow", type: "Martial Ranged Weapon", rarity: "common", description: "A compact crossbow fired with one hand.", damage: "1d6 piercing", properties: "Ammunition (30/120), light, loading", goldCost: 75, weight: 3, category: "weapons" },
  { id: "heavy-crossbow", name: "Heavy Crossbow", type: "Martial Ranged Weapon", rarity: "common", description: "A powerful crossbow requiring a windlass to load.", damage: "1d10 piercing", properties: "Ammunition (100/400), heavy, loading, two-handed", goldCost: 50, weight: 18, category: "weapons" },
  { id: "longbow", name: "Longbow", type: "Martial Ranged Weapon", rarity: "common", description: "A tall bow that launches arrows with tremendous force.", damage: "1d8 piercing", properties: "Ammunition (150/600), heavy, two-handed", goldCost: 50, weight: 2, category: "weapons" },
  { id: "pistol", name: "Pistol", type: "Martial Ranged Weapon (Firearm)", rarity: "uncommon", description: "A black-powder handgun. Loud, deadly, and expensive.", damage: "1d10 piercing", properties: "Ammunition (30/90), loading", goldCost: 250, weight: 3, category: "weapons" },
  { id: "musket", name: "Musket", type: "Martial Ranged Weapon (Firearm)", rarity: "uncommon", description: "A long-barreled firearm with devastating range.", damage: "1d12 piercing", properties: "Ammunition (40/120), loading, two-handed", goldCost: 500, weight: 10, category: "weapons" },
  { id: "ammunition-arrows", name: "Arrows (20)", type: "Ammunition", rarity: "common", description: "A quiver of 20 arrows for bows.", goldCost: 1, weight: 1, category: "weapons" },
  { id: "ammunition-bolts", name: "Bolts (20)", type: "Ammunition", rarity: "common", description: "A case of 20 bolts for crossbows.", goldCost: 1, weight: 1.5, category: "weapons" },
  { id: "ammunition-bullets", name: "Bullets (10)", type: "Ammunition", rarity: "common", description: "Lead balls and black powder for firearms.", goldCost: 3, weight: 2, category: "weapons" },
  { id: "padded-armor", name: "Padded Armor", type: "Light Armor", rarity: "common", description: "Quilted layers of cloth and batting.", armor: 11, properties: "+Dex modifier, disadvantage on Stealth", goldCost: 5, weight: 8, category: "armor" },
  { id: "leather-armor", name: "Leather Armor", type: "Light Armor", rarity: "common", description: "Supple leather that allows for agility.", armor: 11, properties: "+Dex modifier to AC", goldCost: 10, weight: 10, category: "armor" },
  { id: "studded-leather", name: "Studded Leather", type: "Light Armor", rarity: "common", description: "Reinforced leather with close-set rivets.", armor: 12, properties: "+Dex modifier to AC", goldCost: 45, weight: 13, category: "armor" },
  { id: "hide-armor", name: "Hide Armor", type: "Medium Armor", rarity: "common", description: "Crude armor made from thick animal hides.", armor: 12, properties: "+Dex modifier (max 2)", goldCost: 10, weight: 12, category: "armor" },
  { id: "chain-shirt", name: "Chain Shirt", type: "Medium Armor", rarity: "common", description: "Interlocking metal rings worn under clothing.", armor: 13, properties: "+Dex modifier (max 2)", goldCost: 50, weight: 20, category: "armor" },
  { id: "scale-mail", name: "Scale Mail", type: "Medium Armor", rarity: "common", description: "Overlapping metal scales like a dragon's hide.", armor: 14, properties: "+Dex modifier (max 2), disadvantage on Stealth", goldCost: 50, weight: 45, category: "armor" },
  { id: "breastplate", name: "Breastplate", type: "Medium Armor", rarity: "common", description: "A fitted metal chest piece with leather fittings.", armor: 14, properties: "+Dex modifier (max 2)", goldCost: 400, weight: 20, category: "armor" },
  { id: "half-plate", name: "Half Plate", type: "Medium Armor", rarity: "common", description: "Shaped metal plates cover most of the body.", armor: 15, properties: "+Dex modifier (max 2), disadvantage on Stealth", goldCost: 750, weight: 40, category: "armor" },
  { id: "ring-mail", name: "Ring Mail", type: "Heavy Armor", rarity: "common", description: "Leather armor with heavy rings sewn into it.", armor: 14, properties: "Disadvantage on Stealth", goldCost: 30, weight: 40, category: "armor" },
  { id: "chain-mail", name: "Chain Mail", type: "Heavy Armor", rarity: "common", description: "Interlocking metal rings provide solid protection.", armor: 16, properties: "Disadvantage on Stealth, Str 13 required", goldCost: 75, weight: 55, category: "armor" },
  { id: "splint-armor", name: "Splint Armor", type: "Heavy Armor", rarity: "common", description: "Narrow vertical strips of metal riveted to leather.", armor: 17, properties: "Disadvantage on Stealth, Str 15 required", goldCost: 200, weight: 60, category: "armor" },
  { id: "plate-armor", name: "Plate Armor", type: "Heavy Armor", rarity: "common", description: "The finest protection gold can buy. Full body coverage.", armor: 18, properties: "Disadvantage on Stealth, Str 15 required", goldCost: 1500, weight: 65, category: "armor" },
  { id: "wooden-shield", name: "Wooden Shield", type: "Shield", rarity: "common", description: "A sturdy wooden shield.", armor: 2, properties: "+2 AC bonus", goldCost: 10, weight: 6, category: "armor" },
  { id: "steel-shield", name: "Steel Shield", type: "Shield", rarity: "common", description: "A reinforced metal shield for serious combat.", armor: 2, properties: "+2 AC bonus, more durable", goldCost: 15, weight: 6, category: "armor" },
  { id: "healing-potion", name: "Potion of Healing", type: "Potion", rarity: "common", description: "A red liquid that glimmers when agitated. Heals 2d4+2 HP.", properties: "Heals 2d4+2 hit points", goldCost: 50, weight: 0.5, category: "potions" },
  { id: "greater-healing-potion", name: "Potion of Greater Healing", type: "Potion", rarity: "uncommon", description: "A more potent healing draught. Heals 4d4+4 HP.", properties: "Heals 4d4+4 hit points", goldCost: 150, weight: 0.5, category: "potions" },
  { id: "superior-healing-potion", name: "Potion of Superior Healing", type: "Potion", rarity: "rare", description: "An exceptional healing elixir. Heals 8d4+8 HP.", properties: "Heals 8d4+8 hit points", goldCost: 500, weight: 0.5, category: "potions" },
  { id: "antitoxin", name: "Antitoxin", type: "Consumable", rarity: "common", description: "Grants advantage on saves against poison for 1 hour.", properties: "Advantage on poison saves for 1 hour", goldCost: 50, weight: 0.5, category: "potions" },
  { id: "holy-water", name: "Holy Water", type: "Consumable", rarity: "common", description: "Blessed water that burns undead and fiends. Deals 2d6 radiant.", properties: "2d6 radiant vs undead/fiends (thrown)", goldCost: 25, weight: 1, category: "potions" },
  { id: "oil-flask", name: "Oil Flask", type: "Consumable", rarity: "common", description: "Can be lit and thrown or used to coat surfaces.", properties: "5 fire damage per round for 2 rounds", goldCost: 0, silverCost: 1, weight: 1, category: "potions" },
  { id: "alchemists-fire", name: "Alchemist's Fire", type: "Consumable", rarity: "common", description: "A flask of sticky, flammable adhesive.", properties: "1d4 fire per turn until extinguished (DC 10 Dex)", goldCost: 50, weight: 1, category: "potions" },
  { id: "acid-vial", name: "Acid Vial", type: "Consumable", rarity: "common", description: "A vial of corrosive liquid.", properties: "2d6 acid damage (thrown, 20 ft)", goldCost: 25, weight: 1, category: "potions" },
  { id: "thieves-tools", name: "Thieves' Tools", type: "Tools", rarity: "common", description: "Lockpicks and small tools for disabling traps and opening locks.", goldCost: 25, weight: 1, category: "tools" },
  { id: "smiths-tools", name: "Smith's Tools", type: "Artisan's Tools", rarity: "common", description: "Tongs, hammer, and bellows for metalworking.", goldCost: 20, weight: 8, category: "tools" },
  { id: "alchemists-supplies", name: "Alchemist's Supplies", type: "Artisan's Tools", rarity: "common", description: "Beakers, chemicals, and instruments for alchemy.", goldCost: 50, weight: 8, category: "tools" },
  { id: "brewers-supplies", name: "Brewer's Supplies", type: "Artisan's Tools", rarity: "common", description: "A siphon, hops, and fermenting gear.", goldCost: 20, weight: 9, category: "tools" },
  { id: "herbalism-kit", name: "Herbalism Kit", type: "Kit", rarity: "common", description: "Clippers, mortar, pouches for gathering and preparing herbs.", goldCost: 5, weight: 3, category: "tools" },
  { id: "poisoners-kit", name: "Poisoner's Kit", type: "Kit", rarity: "common", description: "Vials, chemicals, and tools for crafting poisons.", goldCost: 50, weight: 2, category: "tools" },
  { id: "tinkers-tools", name: "Tinker's Tools", type: "Artisan's Tools", rarity: "common", description: "Hand tools for crafting small mechanical devices.", goldCost: 50, weight: 10, category: "tools" },
  { id: "leatherworkers-tools", name: "Leatherworker's Tools", type: "Artisan's Tools", rarity: "common", description: "Knives, awls, and thread for working leather.", goldCost: 5, weight: 5, category: "tools" },
  { id: "woodcarvers-tools", name: "Woodcarver's Tools", type: "Artisan's Tools", rarity: "common", description: "Knives, gouges, and a small saw for shaping wood.", goldCost: 1, weight: 5, category: "tools" },
  { id: "component-pouch", name: "Component Pouch", type: "Spellcasting Focus", rarity: "common", description: "A small belt pouch filled with material components for spells.", goldCost: 25, weight: 2, category: "tools" },
  { id: "arcane-focus", name: "Arcane Focus (Crystal)", type: "Spellcasting Focus", rarity: "common", description: "A crystal orb used to channel arcane energy.", goldCost: 10, weight: 1, category: "tools" },
  { id: "holy-symbol", name: "Holy Symbol (Amulet)", type: "Spellcasting Focus", rarity: "common", description: "A sacred symbol of a deity, used for divine spellcasting.", goldCost: 5, weight: 1, category: "tools" },
  { id: "explorers-pack", name: "Explorer's Pack", type: "Equipment Pack", rarity: "common", description: "Includes backpack, bedroll, mess kit, tinderbox, torches, rations, and waterskin.", goldCost: 10, weight: 59, category: "tools" },
  { id: "dungeoneers-pack", name: "Dungeoneer's Pack", type: "Equipment Pack", rarity: "common", description: "Backpack, crowbar, hammer, pitons, torches, tinderbox, rations, waterskin, rope.", goldCost: 12, weight: 61.5, category: "tools" },
  { id: "rope-hemp", name: "Rope (50 ft, Hemp)", type: "Adventuring Gear", rarity: "common", description: "Strong rope for climbing, binding, or other uses.", goldCost: 1, weight: 10, category: "misc" },
  { id: "rope-silk", name: "Rope (50 ft, Silk)", type: "Adventuring Gear", rarity: "common", description: "Lightweight, strong rope prized by thieves and climbers.", goldCost: 10, weight: 5, category: "misc" },
  { id: "torch-bundle", name: "Torches (10)", type: "Adventuring Gear", rarity: "common", description: "A bundle of 10 torches for lighting dark dungeons.", properties: "Bright light 20 ft, dim light additional 20 ft", goldCost: 0, silverCost: 10, weight: 10, category: "misc" },
  { id: "rations", name: "Rations (5 days)", type: "Adventuring Gear", rarity: "common", description: "Dried food for 5 days of travel.", goldCost: 2, silverCost: 5, weight: 10, category: "misc" },
  { id: "caltrops", name: "Caltrops (bag of 20)", type: "Adventuring Gear", rarity: "common", description: "Small iron spikes that slow and damage pursuers.", properties: "Covers 5 ft area, DC 15 Dex or 1 piercing + half speed", goldCost: 1, weight: 2, category: "misc" },
  { id: "grappling-hook", name: "Grappling Hook", type: "Adventuring Gear", rarity: "common", description: "An iron hook for securing ropes at height.", goldCost: 2, weight: 4, category: "misc" },
  { id: "lantern-hooded", name: "Hooded Lantern", type: "Adventuring Gear", rarity: "common", description: "A lantern with a shutter to control its beam.", properties: "Bright light 30 ft, dim 30 more. 6 hours per flask of oil", goldCost: 5, weight: 2, category: "misc" },
  { id: "lantern-bullseye", name: "Bullseye Lantern", type: "Adventuring Gear", rarity: "common", description: "A focused beam lantern for scouting.", properties: "Bright light 60 ft cone, dim 60 more", goldCost: 10, weight: 2, category: "misc" },
  { id: "bedroll", name: "Bedroll", type: "Adventuring Gear", rarity: "common", description: "A warm roll for sleeping outdoors.", goldCost: 1, weight: 7, category: "misc" },
  { id: "spyglass", name: "Spyglass", type: "Adventuring Gear", rarity: "common", description: "A small telescope for observing distant objects.", goldCost: 1000, weight: 1, category: "misc" },
  { id: "manacles", name: "Manacles", type: "Adventuring Gear", rarity: "common", description: "Iron restraints. DC 20 to escape, DC 15 to pick.", goldCost: 2, weight: 6, category: "misc" },
  { id: "tent", name: "Tent (Two-Person)", type: "Adventuring Gear", rarity: "common", description: "A simple canvas tent for shelter.", goldCost: 2, weight: 20, category: "misc" },
  { id: "crowbar", name: "Crowbar", type: "Adventuring Gear", rarity: "common", description: "An iron bar for prying. Grants advantage on Strength checks.", goldCost: 2, weight: 5, category: "misc" },
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

const DOWNTIME_ACTIVITIES = [
  { id: 'mercenary', name: 'Mercenary Work', icon: 'Sword', skill: 'Athletics', risky: true, description: 'Escort duty and hired muscle. An Athletics check sets your pay — botch it and you get hurt.', rewardRange: 'up to ~140 gp' },
  { id: 'performance', name: 'Street Performance', icon: 'Star', skill: 'Performance', risky: false, description: 'Busking and venue shows. A Performance check sets your tips.', rewardRange: 'up to ~110 gp' },
  { id: 'business', name: 'Run a Business', icon: 'TrendingUp', skill: 'Persuasion', risky: false, description: 'Work a trade stall. A Persuasion check drives your profit.', rewardRange: 'up to ~240 gp' },
  { id: 'caravan', name: 'Caravan Guard', icon: 'Shield', skill: 'Perception', risky: true, description: 'Guard a caravan on the road. A Perception check sets your pay — fail and bandits leave a mark.', rewardRange: 'up to ~170 gp' },
  { id: 'training', name: 'Train Others', icon: 'Users', skill: 'Athletics', risky: false, description: 'Teach sparring classes. An Athletics check sets your fee.', rewardRange: 'up to ~100 gp' },
];

interface BountyView {
  id: string;
  target: string;
  description: string;
  reward: number;
  difficulty: string;
  recommendedLevel: string;
  cr: string;
  state: 'available' | 'completed' | 'cooldown';
  cooldownUntil: string | null;
}

interface HuntResult {
  victory: boolean;
  goldEarned: number;
  summary: string;
  log: string[];
  hpStart: number;
  hpEnd: number;
  exhaustionGained: number;
  enemy: { name: string; cr: string; maxHp: number };
}

interface DiceGameState {
  playerDice: number[];
  houseDice: number[];
  playerBet: number;
  playerGuess: { count: number; face: number };
  gamePhase: 'betting' | 'guessing' | 'reveal' | 'result';
  result: 'win' | 'lose' | null;
  winnings: number;
  sessionWins: number;
  sessionLosses: number;
  sessionProfit: number;
  streak: number;
}

function calculateDiceOdds(guessCount: number, guessFace: number, knownDice: number[]): number {
  const knownMatches = knownDice.filter(d => d === guessFace || d === 1).length;
  const unknownDice = 5;
  const needed = Math.max(0, guessCount - knownMatches);
  if (needed === 0) return 1.0;
  if (needed > unknownDice) return 0.0;
  const pSingle = 2 / 6;
  let prob = 0;
  for (let k = needed; k <= unknownDice; k++) {
    const comb = factorial(unknownDice) / (factorial(k) * factorial(unknownDice - k));
    prob += comb * Math.pow(pSingle, k) * Math.pow(1 - pSingle, unknownDice - k);
  }
  return prob;
}

function factorial(n: number): number {
  if (n <= 1) return 1;
  let result = 1;
  for (let i = 2; i <= n; i++) result *= i;
  return result;
}

function getPayoutMultiplier(probability: number): number {
  if (probability >= 0.95) return 1.1;
  if (probability >= 0.8) return 1.4;
  if (probability >= 0.6) return 2.0;
  if (probability >= 0.4) return 3.0;
  if (probability >= 0.25) return 5.0;
  if (probability >= 0.1) return 10.0;
  return 20.0;
}

function getDifficultyLabel(probability: number): { label: string; color: string } {
  if (probability >= 0.8) return { label: "Safe Bet", color: "text-green-500" };
  if (probability >= 0.6) return { label: "Favorable", color: "text-green-400" };
  if (probability >= 0.4) return { label: "Even Odds", color: "text-yellow-500" };
  if (probability >= 0.25) return { label: "Risky", color: "text-orange-500" };
  if (probability >= 0.1) return { label: "Long Shot", color: "text-red-500" };
  return { label: "Desperate", color: "text-red-700" };
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

interface MagicShopItem {
  id: number;
  name: string;
  description: string;
  type: string;
  rarity: string;
  min_level: number;
  max_level: number;
  class_affinity: string[] | null;
  magic_bonus: number;
  damage_dice: string | null;
  damage_type: string | null;
  base_ac: number | null;
  properties: string[] | null;
  special_effect: string | null;
  requires_attunement: boolean;
  shop_price: number;
  lore: string | null;
}

function MagicItemShop({ 
  characterId, 
  characterLevel, 
  characterClass, 
  characterGold 
}: { 
  characterId?: number;
  characterLevel: number;
  characterClass: string;
  characterGold: number;
}) {
  const { toast } = useToast();
  const [selectedItem, setSelectedItem] = useState<MagicShopItem | null>(null);
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);
  const [rarityFilter, setRarityFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const { data: shopItems = [], isLoading } = useQuery<MagicShopItem[]>({
    queryKey: ['/api/magic-items/shop', characterId],
    queryFn: async () => {
      const url = characterId 
        ? `/api/magic-items/shop?characterId=${characterId}`
        : '/api/magic-items/shop';
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch shop items');
      return response.json();
    },
  });

  const purchaseMutation = useMutation({
    mutationFn: async ({ charId, templateId }: { charId: number; templateId: number }) => {
      const response = await apiRequest("POST", "/api/magic-items/shop/purchase", {
        characterId: charId,
        templateId
      });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/characters"] });
      queryClient.invalidateQueries({ queryKey: ["/api/magic-items/shop", characterId] });
      // Invalidate magical inventory query so new item shows up
      queryClient.invalidateQueries({ queryKey: ['/api/characters', characterId, 'magical-inventory'] });
      toast({
        title: "Purchase Complete!",
        description: `You acquired ${data.item?.name || 'a magical item'}!`
      });
      setPurchaseDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Purchase Failed",
        description: error.message || "Could not purchase item",
        variant: "destructive"
      });
    }
  });

  const filteredItems = shopItems.filter(item => {
    if (rarityFilter !== 'all' && item.rarity !== rarityFilter) return false;
    if (typeFilter !== 'all' && item.type !== typeFilter) return false;
    return true;
  });

  const getRarityGradient = (rarity: string) => {
    switch (rarity) {
      case 'uncommon': return 'from-green-500/20 to-green-600/10 border-green-500/50';
      case 'rare': return 'from-blue-500/20 to-blue-600/10 border-blue-500/50';
      case 'very_rare': return 'from-purple-500/20 to-purple-600/10 border-purple-500/50';
      case 'legendary': return 'from-orange-500/20 to-orange-600/10 border-orange-500/50';
      default: return 'from-slate-500/20 to-slate-600/10 border-slate-500/50';
    }
  };

  const formatRarity = (rarity: string) => {
    return rarity.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  const canAffordItem = (price: number) => characterGold >= price;

  const isClassMatch = (classAffinity: string[] | null) => {
    if (!classAffinity || classAffinity.length === 0) return true;
    return classAffinity.some(c => c.toLowerCase() === characterClass.toLowerCase());
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <RefreshCw className="h-8 w-8 mx-auto animate-spin text-amber-600 mb-4" />
          <p className="text-muted-foreground">Loading magical wares...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-purple-500" />
          Enchanted Emporium
        </CardTitle>
        <CardDescription>
          Rare and powerful magical items for discerning adventurers. Items are adjusted for your level and class.
        </CardDescription>
        <div className="flex flex-wrap gap-2 mt-4">
          <Select value={rarityFilter} onValueChange={setRarityFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Rarity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Rarities</SelectItem>
              <SelectItem value="uncommon">Uncommon</SelectItem>
              <SelectItem value="rare">Rare</SelectItem>
              <SelectItem value="very_rare">Very Rare</SelectItem>
              <SelectItem value="legendary">Legendary</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="weapon">Weapons</SelectItem>
              <SelectItem value="armor">Armor</SelectItem>
              <SelectItem value="accessory">Accessories</SelectItem>
              <SelectItem value="wondrous">Wondrous</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {filteredItems.length === 0 ? (
          <div className="text-center py-8">
            <Sparkles className="h-12 w-12 mx-auto text-slate-400 mb-4" />
            <p className="text-muted-foreground">No magical items match your criteria.</p>
            <p className="text-sm text-muted-foreground mt-1">Try adjusting the filters or check back at a higher level.</p>
          </div>
        ) : (
          <ScrollArea className="h-[500px] pr-4">
            <div className="grid gap-4">
              {filteredItems.map((item) => (
                <Card 
                  key={item.id} 
                  className={`bg-gradient-to-r ${getRarityGradient(item.rarity)} cursor-pointer hover:shadow-lg transition-all`}
                  onClick={() => {
                    setSelectedItem(item);
                    setPurchaseDialogOpen(true);
                  }}
                >
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-bold text-lg">{item.name}</h4>
                          {item.magic_bonus > 0 && (
                            <Badge variant="secondary" className="text-xs">+{item.magic_bonus}</Badge>
                          )}
                          {item.requires_attunement && (
                            <Badge variant="outline" className="text-xs">Attunement</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className={getRarityColor(item.rarity)}>
                            {formatRarity(item.rarity)}
                          </Badge>
                          <span className="text-sm text-muted-foreground capitalize">{item.type}</span>
                          {isClassMatch(item.class_affinity) && (
                            <Badge variant="outline" className="text-xs text-green-600 border-green-500">
                              <Check className="h-3 w-3 mr-1" /> Class Match
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">{item.description}</p>
                        {item.special_effect && (
                          <p className="text-sm text-purple-600 dark:text-purple-400 italic">
                            <Sparkles className="h-3 w-3 inline mr-1" />
                            {item.special_effect}
                          </p>
                        )}
                        {item.damage_dice && (
                          <p className="text-sm mt-1">
                            <Sword className="h-3 w-3 inline mr-1" />
                            {item.damage_dice} {item.damage_type}
                          </p>
                        )}
                        {item.base_ac && (
                          <p className="text-sm mt-1">
                            <Shield className="h-3 w-3 inline mr-1" />
                            AC {item.base_ac}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <div className={`text-lg font-bold ${canAffordItem(item.shop_price) ? 'text-yellow-600' : 'text-red-500'}`}>
                          <Coins className="h-4 w-4 inline mr-1" />
                          {item.shop_price.toLocaleString()} gp
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Level {item.min_level}-{item.max_level}
                        </p>
                        {!canAffordItem(item.shop_price) && (
                          <p className="text-xs text-red-500 mt-1">Not enough gold</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>

      <Dialog open={purchaseDialogOpen} onOpenChange={setPurchaseDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" />
              {selectedItem?.name}
            </DialogTitle>
            <DialogDescription>
              {selectedItem?.description}
            </DialogDescription>
          </DialogHeader>
          
          {selectedItem && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge className={getRarityColor(selectedItem.rarity)}>
                  {formatRarity(selectedItem.rarity)}
                </Badge>
                <Badge variant="outline">{selectedItem.type}</Badge>
                {selectedItem.magic_bonus > 0 && (
                  <Badge variant="secondary">+{selectedItem.magic_bonus}</Badge>
                )}
                {selectedItem.requires_attunement && (
                  <Badge variant="outline">Requires Attunement</Badge>
                )}
              </div>

              {selectedItem.special_effect && (
                <div className="p-3 bg-purple-500/10 rounded-lg border border-purple-500/30">
                  <p className="text-sm text-purple-700 dark:text-purple-300">
                    <Sparkles className="h-4 w-4 inline mr-2" />
                    {selectedItem.special_effect}
                  </p>
                </div>
              )}

              {selectedItem.lore && (
                <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-lg">
                  <p className="text-sm italic text-muted-foreground">"{selectedItem.lore}"</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 text-sm">
                {selectedItem.damage_dice && (
                  <div>
                    <span className="text-muted-foreground">Damage:</span>
                    <span className="ml-2 font-medium">{selectedItem.damage_dice} {selectedItem.damage_type}</span>
                  </div>
                )}
                {selectedItem.base_ac && (
                  <div>
                    <span className="text-muted-foreground">AC:</span>
                    <span className="ml-2 font-medium">{selectedItem.base_ac}</span>
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground">Level Range:</span>
                  <span className="ml-2 font-medium">{selectedItem.min_level}-{selectedItem.max_level}</span>
                </div>
                {selectedItem.class_affinity && selectedItem.class_affinity.length > 0 && (
                  <div>
                    <span className="text-muted-foreground">Best For:</span>
                    <span className="ml-2 font-medium">{selectedItem.class_affinity.join(', ')}</span>
                  </div>
                )}
              </div>

              <Separator />

              <div className="flex justify-between items-center">
                <div>
                  <p className="text-2xl font-bold text-yellow-600">
                    <Coins className="h-5 w-5 inline mr-2" />
                    {selectedItem.shop_price.toLocaleString()} gp
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Your gold: {characterGold.toLocaleString()} gp
                  </p>
                </div>
                <Button
                  size="lg"
                  disabled={!characterId || !canAffordItem(selectedItem.shop_price) || purchaseMutation.isPending}
                  onClick={() => {
                    if (characterId) {
                      purchaseMutation.mutate({ charId: characterId, templateId: selectedItem.id });
                    }
                  }}
                >
                  {purchaseMutation.isPending ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <ShoppingBag className="h-4 w-4 mr-2" />
                  )}
                  Purchase
                </Button>
              </div>

              {!canAffordItem(selectedItem.shop_price) && (
                <div className="flex items-center gap-2 text-red-500 text-sm">
                  <AlertTriangle className="h-4 w-4" />
                  You need {(selectedItem.shop_price - characterGold).toLocaleString()} more gold
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// SRD Shop - Official D&D 5e content from open5e with level-based unlocking
function SRDShop({ 
  characterId, 
  characterLevel, 
  characterGold,
  onPurchase
}: { 
  characterId?: number;
  characterLevel: number;
  characterGold: number;
  onPurchase: (itemName: string, cost: number, itemData: any) => void;
}) {
  const [category, setCategory] = useState<'weapons' | 'armor' | 'magicitems'>('weapons');
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const { toast } = useToast();

  const { data: weaponsData, isLoading: weaponsLoading } = useQuery<any>({
    queryKey: ['/api/open5e/weapons'],
    queryFn: async () => {
      const res = await fetch('/api/open5e/weapons?limit=50');
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
    enabled: category === 'weapons',
  });

  const { data: armorData, isLoading: armorLoading } = useQuery<any>({
    queryKey: ['/api/open5e/armor'],
    queryFn: async () => {
      const res = await fetch('/api/open5e/armor?limit=50');
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
    enabled: category === 'armor',
  });

  const { data: magicItemsData, isLoading: magicItemsLoading } = useQuery<any>({
    queryKey: ['/api/open5e/magicitems', 'shop'],
    queryFn: async () => {
      const res = await fetch('/api/open5e/magicitems?limit=50');
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
    enabled: category === 'magicitems',
  });

  const { data: economyPriceData } = useQuery<any>({
    queryKey: ['/api/economy/prices', characterId],
    queryFn: async () => {
      const url = characterId ? `/api/economy/prices?characterId=${characterId}` : '/api/economy/prices';
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
  });

  const srdPriceMap: Record<string, number> = {};
  if (economyPriceData?.prices) {
    for (const p of economyPriceData.prices) {
      srdPriceMap[p.itemSlug] = p.finalPriceGold ?? p.basePrice ?? 10;
    }
  }

  const isLoading = weaponsLoading || armorLoading || magicItemsLoading;

  // Level requirements based on item type/rarity
  const getLevelRequirement = (item: any, itemCategory: string): number => {
    if (itemCategory === 'magicitems') {
      const rarity = (item.rarity || '').toLowerCase();
      if (rarity.includes('legendary')) return 15;
      if (rarity.includes('very rare')) return 11;
      if (rarity.includes('rare')) return 7;
      if (rarity.includes('uncommon')) return 3;
      return 1;
    }
    if (itemCategory === 'armor') {
      const category = (item.category?.name || '').toLowerCase();
      if (category.includes('heavy')) return 5;
      if (category.includes('medium')) return 3;
      return 1;
    }
    if (itemCategory === 'weapons') {
      const category = (item.category?.name || '').toLowerCase();
      if (category.includes('martial')) return 3;
      return 1;
    }
    return 1;
  };

  const getItemPrice = (item: any, itemCategory: string): number => {
    if (itemCategory === 'magicitems') {
      const rarity = (item.rarity || '').toLowerCase();
      if (rarity.includes('legendary')) return 50000;
      if (rarity.includes('very rare')) return 10000;
      if (rarity.includes('rare')) return 2000;
      if (rarity.includes('uncommon')) return 400;
      return 100;
    }
    const slug = item.slug || item.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    if (slug && srdPriceMap[slug] !== undefined) {
      return srdPriceMap[slug];
    }
    const costStr = item.cost || '';
    const match = costStr.match(/([\d.]+)\s*(gp|sp|cp)/i);
    if (match) {
      const value = parseFloat(match[1]);
      const unit = match[2].toLowerCase();
      if (unit === 'gp') return value;
      if (unit === 'sp') return Math.max(1, Math.ceil(value / 10));
      if (unit === 'cp') return Math.max(1, Math.ceil(value / 100));
    }
    return 10;
  };

  const isUnlocked = (item: any, itemCategory: string) => {
    return characterLevel >= getLevelRequirement(item, itemCategory);
  };

  const canAfford = (price: number) => characterGold >= price;

  const handlePurchase = (item: any, itemCategory: string) => {
    if (!characterId) {
      toast({ title: 'Select a character', description: 'Choose a character to make purchases.', variant: 'destructive' });
      return;
    }
    const price = getItemPrice(item, itemCategory);
    if (!canAfford(price)) {
      toast({ title: 'Not enough gold!', variant: 'destructive' });
      return;
    }
    onPurchase(item.name, price, {
      name: item.name,
      type: itemCategory === 'weapons' ? (item.category?.name || 'Weapon') : 
            itemCategory === 'armor' ? (item.category?.name || 'Armor') : 
            (item.type || 'Wondrous Item'),
      rarity: item.rarity || 'common',
      description: item.desc || item.description || '',
      damage: item.damage_dice || (item.damage?.dice ? `${item.damage.dice} ${item.damage_type?.name || ''}` : undefined),
      armor: item.base_ac,
      properties: item.properties?.map((p: any) => p.name || p).join(', '),
      source: 'srd'
    });
    setSelectedItem(null);
  };

  const getCurrentItems = () => {
    switch (category) {
      case 'weapons': return weaponsData?.results || [];
      case 'armor': return armorData?.results || [];
      case 'magicitems': return magicItemsData?.results || [];
    }
  };

  const items = getCurrentItems();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Scroll className="h-5 w-5 text-blue-500" />
          SRD Equipment Shop
        </CardTitle>
        <CardDescription>
          Official D&D 5e equipment from the SRD. Higher-tier items unlock as you level up.
        </CardDescription>
        <div className="flex gap-2 mt-3">
          {[
            { id: 'weapons', label: 'Weapons', icon: Sword },
            { id: 'armor', label: 'Armor', icon: Shield },
            { id: 'magicitems', label: 'Magic Items', icon: Sparkles },
          ].map(({ id, label, icon: Icon }) => (
            <Button
              key={id}
              variant={category === id ? 'default' : 'outline'}
              size="sm"
              onClick={() => { setCategory(id as any); setSelectedItem(null); }}
              className="gap-1"
            >
              <Icon className="h-4 w-4" />
              {label}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8">
            <RefreshCw className="h-8 w-8 mx-auto animate-spin text-blue-500 mb-2" />
            <p className="text-muted-foreground">Loading SRD items...</p>
          </div>
        ) : selectedItem ? (
          <div className="space-y-4">
            <Button variant="ghost" size="sm" onClick={() => setSelectedItem(null)}>
              ← Back to list
            </Button>
            <div className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-bold">{selectedItem.name}</h3>
                {!isUnlocked(selectedItem, category) && (
                  <Badge variant="destructive">Level {getLevelRequirement(selectedItem, category)} Required</Badge>
                )}
                {category === 'magicitems' && selectedItem.rarity && (
                  <Badge variant="secondary">{selectedItem.rarity}</Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {category === 'weapons' && selectedItem.category?.name}
                {category === 'armor' && selectedItem.category?.name}
                {category === 'magicitems' && selectedItem.type}
              </p>
              {selectedItem.damage_dice && (
                <p className="text-sm"><strong>Damage:</strong> {selectedItem.damage_dice} {selectedItem.damage_type?.name}</p>
              )}
              {selectedItem.damage?.dice && (
                <p className="text-sm"><strong>Damage:</strong> {selectedItem.damage.dice} {selectedItem.damage_type?.name}</p>
              )}
              {selectedItem.base_ac !== undefined && (
                <p className="text-sm"><strong>AC:</strong> {selectedItem.base_ac}{selectedItem.plus_dex_mod ? ' + Dex' : ''}{selectedItem.plus_max ? ` (max ${selectedItem.plus_max})` : ''}</p>
              )}
              {selectedItem.properties && selectedItem.properties.length > 0 && (
                <p className="text-sm"><strong>Properties:</strong> {selectedItem.properties.map((p: any) => p.name || p).join(', ')}</p>
              )}
              {selectedItem.desc && (
                <p className="text-sm whitespace-pre-wrap">{selectedItem.desc}</p>
              )}
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xl font-bold text-yellow-600">
                    <Coins className="h-4 w-4 inline mr-1" />
                    {getItemPrice(selectedItem, category).toLocaleString()} gp
                  </p>
                  <p className="text-xs text-muted-foreground">Your gold: {characterGold.toLocaleString()} gp</p>
                </div>
                <Button
                  disabled={!isUnlocked(selectedItem, category) || !canAfford(getItemPrice(selectedItem, category)) || !characterId}
                  onClick={() => handlePurchase(selectedItem, category)}
                >
                  <ShoppingBag className="h-4 w-4 mr-2" />
                  Purchase
                </Button>
              </div>
              {!isUnlocked(selectedItem, category) && (
                <p className="text-sm text-orange-600">Reach level {getLevelRequirement(selectedItem, category)} to unlock this item.</p>
              )}
              {!canAfford(getItemPrice(selectedItem, category)) && isUnlocked(selectedItem, category) && (
                <p className="text-sm text-red-500">You need {(getItemPrice(selectedItem, category) - characterGold).toLocaleString()} more gold.</p>
              )}
            </div>
            <Separator />
            <p className="text-xs text-muted-foreground text-center">
              Data from <a href="https://open5e.com" target="_blank" rel="noopener noreferrer" className="underline">open5e.com</a> · SRD 5.1 CC-BY-4.0
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            <div className="grid gap-2">
              {items.map((item: any) => {
                const levelReq = getLevelRequirement(item, category);
                const unlocked = isUnlocked(item, category);
                const price = getItemPrice(item, category);
                const affordable = canAfford(price);
                
                return (
                  <div
                    key={item.slug || item.key || item.name}
                    className={`p-3 border rounded-lg cursor-pointer transition-all ${
                      unlocked 
                        ? 'hover:bg-muted/50 hover:border-amber-500/50' 
                        : 'opacity-60 bg-slate-100 dark:bg-slate-800'
                    }`}
                    onClick={() => setSelectedItem(item)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`font-medium truncate ${!unlocked ? 'text-muted-foreground' : ''}`}>
                            {item.name}
                          </span>
                          {!unlocked && (
                            <Badge variant="outline" className="text-xs shrink-0">
                              Lv {levelReq}
                            </Badge>
                          )}
                          {category === 'magicitems' && item.rarity && (
                            <Badge variant="secondary" className="text-xs shrink-0">{item.rarity}</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {category === 'weapons' && (item.damage_dice || item.damage?.dice || '')}
                          {category === 'armor' && (item.base_ac !== undefined ? `AC ${item.base_ac}` : '')}
                          {category === 'magicitems' && (item.type || '')}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className={`font-medium ${affordable && unlocked ? 'text-yellow-600' : 'text-muted-foreground'}`}>
                          {price.toLocaleString()} gp
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
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
        <Link key={post.id} href="/community?tab=find-a-game">
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
  const [tavernTab, setTavernTab] = useState<'drinks' | 'party' | 'rumors' | 'games' | 'crafting' | 'downtime'>('drinks');
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
    playerGuess: { count: 2, face: 6 },
    gamePhase: 'betting',
    result: null,
    winnings: 0,
    sessionWins: 0,
    sessionLosses: 0,
    sessionProfit: 0,
    streak: 0,
  });
  
  // Gold transfer state
  const [goldTransferOpen, setGoldTransferOpen] = useState(false);
  const [transferRecipient, setTransferRecipient] = useState<number | null>(null);
  const [transferAmount, setTransferAmount] = useState(1);
  
  const rollDice = (count: number): number[] => {
    return Array.from({ length: count }, () => Math.floor(Math.random() * 6) + 1);
  };


  // Work cooldowns are now server-authoritative (character.downtimeState: { [activityId]: cooldownUntilISO }).
  const getActivityCooldown = (id: string): number => {
    const state = (activeCharacter as any)?.downtimeState as Record<string, string> | undefined;
    const until = state?.[id] ? Date.parse(state[id]) : 0;
    return until && until > Date.now() ? until : 0;
  };
  const isActivityDone = (id: string) => getActivityCooldown(id) > 0;
  const formatCooldown = (until: number): string => {
    const hrs = Math.ceil((until - Date.now()) / (1000 * 60 * 60));
    return hrs >= 1 ? `~${hrs}h` : 'soon';
  };

  const downtimeMutation = useMutation({
    mutationFn: async ({ characterId, activity }: { characterId: number; activity: string }) => {
      const response = await apiRequest("POST", `/api/characters/${characterId}/downtime`, { activity });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/characters"] });
      const r = data.roll;
      const rollLine = r ? ` (${r.skill} check: ${r.natural}${r.modifier >= 0 ? '+' : ''}${r.modifier} = ${r.total}${r.disadvantage ? ', disadvantage' : ''})` : '';
      if (data.outcome === 'complication') {
        toast({ title: 'Downtime: Complication!', description: `${data.description}${rollLine}`, variant: 'destructive' });
      } else {
        toast({ title: `Downtime: +${data.goldEarned} gp (${data.outcome})`, description: `${data.description}${rollLine}` });
      }
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to process downtime", variant: "destructive" });
    }
  });

  const performDowntime = (activity: { id: string }) => {
    if (!activeCharacter) return;
    downtimeMutation.mutate({ characterId: activeCharacter.id, activity: activity.id });
  };

  const [huntResult, setHuntResult] = useState<HuntResult | null>(null);

  const huntMutation = useMutation({
    mutationFn: async ({ characterId, bountyId }: { characterId: number; bountyId: string }): Promise<HuntResult> => {
      const response = await apiRequest("POST", `/api/characters/${characterId}/bounties/${bountyId}/hunt`, {});
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/characters"] });
      if (activeCharacter) queryClient.invalidateQueries({ queryKey: ["/api/characters", activeCharacter.id, "bounties"] });
      setHuntResult(data);
      toast({
        title: data.victory ? `Bounty claimed! +${data.goldEarned} gp` : "Hunt failed",
        description: data.summary,
        variant: data.victory ? undefined : "destructive",
      });
    },
    onError: (error: any) => {
      toast({ title: "Hunt unavailable", description: error.message || "Failed to start the hunt", variant: "destructive" });
    }
  });

  const huntBounty = (bountyId: string) => {
    if (!activeCharacter) return;
    huntMutation.mutate({ characterId: activeCharacter.id, bountyId });
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
  
  const MAX_SESSION_PROFIT = 500;
  const MAX_BET = 200;
  const HOUSE_EDGE = 1.0;
  
  const startDiceGame = () => {
    if (!activeCharacter || characterGold < diceGame.playerBet) {
      toast({ title: "Not enough gold!", variant: "destructive" });
      return;
    }
    if (diceGame.playerBet > MAX_BET) {
      toast({ title: `Max bet is ${MAX_BET} gp!`, variant: "destructive" });
      return;
    }
    if (diceGame.sessionProfit >= MAX_SESSION_PROFIT) {
      toast({ title: "The house cuts you off!", description: "You've won enough for today. Come back tomorrow.", variant: "destructive" });
      return;
    }
    const playerDice = rollDice(5);
    const houseDice = rollDice(5);
    setDiceGame(prev => ({
      ...prev,
      playerDice,
      houseDice,
      playerGuess: { count: 2, face: 6 },
      gamePhase: 'guessing'
    }));
  };
  
  const makeGuess = () => {
    const allDice = [...diceGame.playerDice, ...diceGame.houseDice];
    const actualCount = allDice.filter(d => d === diceGame.playerGuess.face || d === 1).length;
    const won = actualCount >= diceGame.playerGuess.count;
    
    const probability = calculateDiceOdds(diceGame.playerGuess.count, diceGame.playerGuess.face, diceGame.playerDice);
    const payoutMult = getPayoutMultiplier(probability);
    const rawPayout = won ? Math.floor(diceGame.playerBet * payoutMult * HOUSE_EDGE) : 0;
    const netWinnings = won ? rawPayout - diceGame.playerBet : -diceGame.playerBet;
    
    if (activeCharacter) {
      diceGameMutation.mutate({ characterId: activeCharacter.id, goldChange: netWinnings });
    }
    
    setDiceGame(prev => ({
      ...prev,
      gamePhase: 'result',
      result: won ? 'win' : 'lose',
      winnings: netWinnings,
      sessionWins: won ? prev.sessionWins + 1 : prev.sessionWins,
      sessionLosses: won ? prev.sessionLosses : prev.sessionLosses + 1,
      sessionProfit: prev.sessionProfit + netWinnings,
      streak: won ? prev.streak + 1 : 0,
    }));
  };
  
  const resetDiceGame = () => {
    setDiceGame(prev => ({
      playerDice: [],
      houseDice: [],
      playerBet: 5,
      playerGuess: { count: 2, face: 6 },
      gamePhase: 'betting',
      result: null,
      winnings: 0,
      sessionWins: prev.sessionWins,
      sessionLosses: prev.sessionLosses,
      sessionProfit: prev.sessionProfit,
      streak: prev.streak,
    }));
  };

  const { data: characters = [] } = useQuery<any[]>({
    queryKey: ["/api/characters"],
    enabled: !!user
  });

  // Prefer an explicitly chosen character; otherwise default to one who is
  // actually in town. The old `|| characters[0]` silently picked whoever came
  // first, including a character who was mid-delve.
  const activeCharacter =
    characters.find(c => c.id === selectedCharacter) ||
    characters.find((c: any) => !c.engagement) ||
    characters[0];

  const { data: bounties = [] } = useQuery<BountyView[]>({
    queryKey: ["/api/characters", activeCharacter?.id, "bounties"],
    queryFn: async () => {
      if (!activeCharacter?.id) return [];
      const response = await fetch(`/api/characters/${activeCharacter.id}/bounties`, { credentials: 'include' });
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!activeCharacter?.id,
  });

  // Fetch magical inventory from character_inventory table
  const { data: magicalInventory = [] } = useQuery<any[]>({
    queryKey: ['/api/characters', activeCharacter?.id, 'magical-inventory'],
    queryFn: async () => {
      if (!activeCharacter?.id) return [];
      const response = await fetch(`/api/characters/${activeCharacter.id}/magical-inventory`, { credentials: 'include' });
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!activeCharacter?.id
  });

  const { data: marketPrices } = useQuery<{ prices: Array<{ itemSlug: string; finalPriceGold: number; finalPriceSilver: number; trend: string; demandMultiplier: number; basePrice: number }>, inflationMultiplier: number }>({
    queryKey: ['/api/economy/prices', activeCharacter?.id],
    queryFn: async () => {
      const url = activeCharacter?.id ? `/api/economy/prices?characterId=${activeCharacter.id}` : '/api/economy/prices';
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) return { prices: [], inflationMultiplier: 1.0 };
      return response.json();
    },
    staleTime: 30000,
  });

  const getDynamicPrice = (item: ShopItem): { gold: number; silver: number; trend: string } => {
    const priceData = marketPrices?.prices?.find(p => p.itemSlug === item.id);
    if (priceData) {
      return { gold: priceData.finalPriceGold, silver: priceData.finalPriceSilver, trend: priceData.trend };
    }
    return { gold: item.goldCost, silver: item.silverCost || 0, trend: "stable" };
  };

  const buyItemMutation = useMutation({
    mutationFn: async ({ characterId, item, qty }: { characterId: number; item: ShopItem; qty: number }) => {
      const dynamicP = getDynamicPrice(item);
      const response = await apiRequest("POST", `/api/characters/${characterId}/buy-item`, {
        itemName: item.name,
        itemType: item.type,
        itemRarity: item.rarity,
        itemDescription: item.description,
        itemProperties: item.properties,
        itemDamage: item.damage,
        itemArmor: item.armor,
        goldCost: dynamicP.gold * qty,
        silverCost: dynamicP.silver * qty,
        quantity: qty
      });
      return response.json();
    },
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: ["/api/characters"] });
      queryClient.invalidateQueries({ queryKey: ['/api/economy/prices'] });
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
      // Force immediate refetch to update inventory display (both regular and magical)
      await queryClient.refetchQueries({ queryKey: ["/api/characters"] });
      if (activeCharacter) {
        await queryClient.invalidateQueries({ queryKey: ['/api/characters', activeCharacter.id, 'magical-inventory'] });
      }
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
  
  // Equip/unequip magical item mutation
  const equipMagicalItemMutation = useMutation({
    mutationFn: async ({ characterId, itemId, slot }: { characterId: number; itemId: number; slot?: string }) => {
      const response = await apiRequest("POST", `/api/characters/${characterId}/inventory/${itemId}/equip`, {
        slot
      });
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/characters', variables.characterId, 'magical-inventory'] });
      queryClient.invalidateQueries({ queryKey: ["/api/characters"] });
      toast({
        title: variables.slot ? "Item Equipped!" : "Item Unequipped!",
        description: variables.slot ? "Your magical item is now equipped." : "Your magical item has been unequipped."
      });
    },
    onError: (error: any) => {
      toast({
        title: "Equip Failed",
        description: error.message || "Could not equip/unequip item.",
        variant: "destructive"
      });
    }
  });
  
  // Equip/unequip basic (non-magical) gear — weapons, armor, shields bought from
  // the shop live in character.equipment. The shop never offered an equip action
  // for them, so purchased armor/shields couldn't be worn. Mirrors the equip flow
  // in the campaign view (POST /equipment/equip|unequip).
  const equipBasicItemMutation = useMutation({
    mutationFn: async ({ characterId, item, slot, equip }: { characterId: number; item: string; slot: string; equip: boolean }) => {
      const path = equip ? "equip" : "unequip";
      const body = equip ? { item, slot } : { slot };
      const response = await apiRequest("POST", `/api/characters/${characterId}/equipment/${path}`, body);
      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/characters"] });
      toast({
        title: variables.equip ? "Equipped!" : "Unequipped!",
        description: data?.message || (variables.equip ? "Item equipped." : "Item unequipped."),
      });
    },
    onError: (error: any) => {
      toast({
        title: "Equip Failed",
        description: error.message || "Could not equip/unequip item.",
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
  
  const [craftingFilter, setCraftingFilter] = useState<string>("all");
  const [craftResult, setCraftResult] = useState<any>(null);

  const { data: craftingRecipes = [] } = useQuery<any[]>({
    queryKey: ["/api/crafting/recipes"],
  });

  const craftMutation = useMutation({
    mutationFn: async ({ characterId, recipeId }: { characterId: number; recipeId: string }) => {
      const response = await apiRequest("POST", "/api/crafting/craft", { characterId, recipeId });
      return response.json();
    },
    onSuccess: (data) => {
      setCraftResult(data);
      queryClient.invalidateQueries({ queryKey: ["/api/characters"] });
      toast({
        title: data.success ? "Crafting Success!" : "Crafting Failed",
        description: data.message,
        variant: data.success ? "default" : "destructive"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Cannot Craft",
        description: error.message || "Crafting failed.",
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
  const basicEquipment: InventoryItem[] = (activeCharacter?.equipment || []).map((item: string | InventoryItem) => {
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
  
  // Convert magical inventory items to InventoryItem format and merge with basic equipment
  const magicalItems: InventoryItem[] = magicalInventory.map((item: any) => ({
    name: item.name,
    type: item.type,
    rarity: item.rarity || 'common',
    description: item.description,
    equipped: item.is_equipped,
    damage: item.damage_dice ? `${item.damage_dice}${item.magic_bonus ? ` +${item.magic_bonus}` : ''} ${item.damage_type || ''}`.trim() : undefined,
    armor: item.base_ac,
    properties: item.properties,
    isMagical: true,
    magicItemId: item.id,
    equipSlot: item.equip_slot,
    specialEffect: item.special_effect,
    requiresAttunement: item.requires_attunement,
    isAttuned: item.is_attuned
  }));
  
  // Combine both inventories
  const characterEquipment: InventoryItem[] = [...basicEquipment, ...magicalItems];

  // Consumables (potions/scrolls/antitoxin) bought from the shop are stored on
  // character.consumables, NOT in equipment — so they were never shown in the
  // inventory list. Surface them here so purchased usables actually appear.
  const consumableItems: InventoryItem[] = (activeCharacter?.consumables || []).map((c: any) => ({
    name: c.name,
    type: c.type ? `Consumable · ${c.type}` : 'Consumable',
    rarity: 'common',
    description: c.effect || c.description || '',
    quantity: c.quantity || 1,
    isConsumable: true,
  }));

  // Items shown in the Inventory tab = gear + magical items + consumables.
  // (The Blacksmith forge and encumbrance still use characterEquipment only —
  // you don't repair or meaningfully encumber yourself with potions here.)
  const inventoryDisplayItems: InventoryItem[] = [...characterEquipment, ...consumableItems];

  // Which equip slot (if any) a basic item belongs to, inferred from its type.
  const getBasicEquipSlot = (item: InventoryItem): string | null => {
    const t = (item.type || '').toLowerCase();
    if (t.includes('shield')) return 'shield';
    if (t.includes('armor')) return 'armor';
    if (t.includes('weapon')) return 'weapon';
    return null;
  };
  // Is this basic item currently equipped? The character stores the equipped item
  // (as a JSON string or plain name) in equippedWeapon/Armor/Shield/Accessory.
  const isBasicItemEquipped = (item: InventoryItem, slot: string): boolean => {
    const field = slot === 'armor' ? 'equippedArmor'
      : slot === 'shield' ? 'equippedShield'
      : slot === 'weapon' ? 'equippedWeapon' : 'equippedAccessory';
    const raw = (activeCharacter as any)?.[field];
    if (!raw) return false;
    let name = raw;
    try { name = JSON.parse(raw).name; } catch { /* plain string */ }
    return typeof name === 'string' && name.toLowerCase() === item.name?.toLowerCase();
  };

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
    const dynamicP = getDynamicPrice(item);
    const totalGold = dynamicP.gold * qty;
    const totalSilver = dynamicP.silver * qty;
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
                    {char.name} (Lv. {char.level}){char.engagement ? ` — ${char.engagement.label}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {activeCharacter?.engagement && (
          <EngagedCharacterNotice
            character={activeCharacter as any}
            activity="visit the tavern"
            className="mb-6"
          />
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

        <SidebarTabs defaultValue="shop">
          <SidebarTabsList className="grid w-full grid-cols-6 mb-6">
            <SidebarTabsTrigger value="shop" className="flex items-center gap-2">
              <ShoppingBag className="h-4 w-4" />
              <span className="hidden sm:inline">Shop</span>
            </SidebarTabsTrigger>
            <SidebarTabsTrigger value="srd-shop" className="flex items-center gap-2">
              <Scroll className="h-4 w-4" />
              <span className="hidden sm:inline">SRD Gear</span>
            </SidebarTabsTrigger>
            <SidebarTabsTrigger value="magic-shop" className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              <span className="hidden sm:inline">Magic Items</span>
            </SidebarTabsTrigger>
            <SidebarTabsTrigger value="inventory" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              <span className="hidden sm:inline">Inventory</span>
            </SidebarTabsTrigger>
            <SidebarTabsTrigger value="repair" className="flex items-center gap-2">
              <Wrench className="h-4 w-4" />
              <span className="hidden sm:inline">Repair</span>
            </SidebarTabsTrigger>
            <SidebarTabsTrigger value="social" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Tavern</span>
            </SidebarTabsTrigger>
          </SidebarTabsList>

          <TabsContent value="shop">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingBag className="h-5 w-5" />
                  General Store
                </CardTitle>
                <CardDescription className="flex items-center justify-between">
                  <span>Browse weapons, armor, potions, and adventuring supplies</span>
                  {marketPrices && marketPrices.inflationMultiplier !== 1.0 && (
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      marketPrices.inflationMultiplier > 1.1 
                        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' 
                        : marketPrices.inflationMultiplier < 0.9
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                    }`}>
                      Gold {marketPrices.inflationMultiplier > 1.0 ? 'inflation' : 'deflation'}: {Math.round((marketPrices.inflationMultiplier - 1) * 100)}%
                    </span>
                  )}
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
                                {(() => {
                                  const dp = getDynamicPrice(item);
                                  return `${dp.gold} gp${dp.silver > 0 ? ` ${dp.silver} sp` : ''}`;
                                })()}
                              </span>
                              {(() => {
                                const dp = getDynamicPrice(item);
                                if (dp.trend === "rising") return <TrendingUp className="h-3 w-3 text-red-500 ml-1" />;
                                if (dp.trend === "falling") return <TrendingDown className="h-3 w-3 text-green-500 ml-1" />;
                                return null;
                              })()}
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

          <TabsContent value="srd-shop">
            <SRDShop 
              characterId={activeCharacter?.id}
              characterLevel={activeCharacter?.level || 1}
              characterGold={characterGold}
              onPurchase={async (itemName, cost, itemData) => {
                if (!activeCharacter) return;
                try {
                  await buyItemMutation.mutateAsync({
                    characterId: activeCharacter.id,
                    item: {
                      id: itemName.toLowerCase().replace(/\s+/g, '-'),
                      name: itemName,
                      type: itemData.type,
                      rarity: itemData.rarity,
                      description: itemData.description,
                      properties: itemData.properties,
                      damage: itemData.damage,
                      armor: itemData.armor,
                      goldCost: cost,
                      weight: 1,
                      category: 'weapons'
                    },
                    qty: 1
                  });
                } catch (e) {
                  // Error handled by mutation
                }
              }}
            />
          </TabsContent>

          <TabsContent value="magic-shop">
            <MagicItemShop 
              characterId={activeCharacter?.id}
              characterLevel={activeCharacter?.level || 1}
              characterClass={activeCharacter?.class || 'Fighter'}
              characterGold={characterGold}
            />
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

                {inventoryDisplayItems.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Your inventory is empty.</p>
                    <p className="text-sm">Visit the shop to buy some gear!</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[500px]">
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {inventoryDisplayItems.map((item, index) => (
                        <Card key={item.isMagical ? `magic-${item.magicItemId}` : (item.isConsumable ? `consumable-${item.name}-${index}` : index)} className={`${item.equipped ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/20' : ''} ${item.isMagical ? 'border-purple-400/50' : ''} ${item.isConsumable ? 'border-emerald-400/40' : ''}`}>
                          <CardContent className="p-4">
                            <div className="flex justify-between items-start mb-2">
                              <h4 className="font-bold flex items-center gap-2">
                                {item.isMagical && <Sparkles className="h-4 w-4 text-purple-500" />}
                                {typeof item === 'string' ? item : item.name}
                                {item.equipped && <Star className="h-4 w-4 text-amber-500" />}
                              </h4>
                              <div className="flex items-center gap-1">
                                {item.isConsumable && item.quantity && item.quantity > 1 && (
                                  <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 text-xs">
                                    ×{item.quantity}
                                  </Badge>
                                )}
                                {item.isMagical && (
                                  <Badge variant="secondary" className="bg-purple-100 text-purple-700 text-xs">
                                    Magic
                                  </Badge>
                                )}
                                {item.isConsumable && (
                                  <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 text-xs">
                                    Consumable
                                  </Badge>
                                )}
                                {typeof item !== 'string' && !item.isConsumable && item.rarity && (
                                  <Badge variant={getRarityBadgeVariant(item.rarity)} className={getRarityColor(item.rarity)}>
                                    {item.rarity}
                                  </Badge>
                                )}
                              </div>
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
                                {item.specialEffect && (
                                  <p className="text-xs text-purple-600 dark:text-purple-400 italic mb-1">
                                    ✨ {item.specialEffect}
                                  </p>
                                )}
                                {item.requiresAttunement && (
                                  <p className={`text-xs mb-1 ${item.isAttuned ? 'text-green-600' : 'text-orange-500'}`}>
                                    {item.isAttuned ? '🔮 Attuned' : '⚠️ Requires attunement'}
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
                            {item.isConsumable ? (
                              <div className="flex items-center gap-1.5 text-sm text-emerald-700 dark:text-emerald-400">
                                <FlaskConical className="h-4 w-4" />
                                <span>Use during your adventure{item.quantity && item.quantity > 1 ? ` (${item.quantity} held)` : ''}</span>
                              </div>
                            ) : (
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1">
                                <Coins className="h-4 w-4 text-yellow-600" />
                                <span className="text-sm text-slate-600 dark:text-slate-400">
                                  Sell: {getSellPrice(typeof item === 'string' ? { name: item, rarity: 'common', type: 'misc', description: '' } : item)} gp
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                {item.isMagical && item.magicItemId && (
                                  <Button
                                    size="sm"
                                    variant={item.equipped ? "secondary" : "default"}
                                    disabled={equipMagicalItemMutation.isPending}
                                    onClick={() => {
                                      if (!activeCharacter) return;
                                      equipMagicalItemMutation.mutate({
                                        characterId: activeCharacter.id,
                                        itemId: item.magicItemId!,
                                        slot: item.equipped ? undefined : (item.equipSlot || item.type || 'main_hand')
                                      });
                                    }}
                                  >
                                    {item.equipped ? 'Unequip' : 'Equip'}
                                  </Button>
                                )}
                                {!item.isMagical && getBasicEquipSlot(item) && (() => {
                                  const slot = getBasicEquipSlot(item)!;
                                  const equipped = isBasicItemEquipped(item, slot);
                                  return (
                                    <Button
                                      size="sm"
                                      variant={equipped ? "secondary" : "default"}
                                      disabled={equipBasicItemMutation.isPending}
                                      onClick={() => {
                                        if (!activeCharacter) return;
                                        equipBasicItemMutation.mutate({
                                          characterId: activeCharacter.id,
                                          item: item.name,
                                          slot,
                                          equip: !equipped,
                                        });
                                      }}
                                    >
                                      {equipped ? 'Unequip' : 'Equip'}
                                    </Button>
                                  );
                                })()}
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
                            </div>
                            )}
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
                <div className="grid grid-cols-3 md:grid-cols-3 gap-4 mb-6">
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
                  <button
                    onClick={() => setTavernTab('crafting')}
                    className={`p-4 text-center rounded-lg border-2 transition-all ${tavernTab === 'crafting' ? 'bg-amber-100 dark:bg-amber-900/30 border-amber-500' : 'bg-slate-50 dark:bg-slate-800 border-transparent hover:border-amber-300'}`}
                  >
                    <Hammer className="h-8 w-8 mx-auto mb-2 text-amber-600" />
                    <p className="text-sm font-medium">Crafting</p>
                  </button>
                  <button
                    onClick={() => setTavernTab('downtime')}
                    className={`p-4 text-center rounded-lg border-2 transition-all ${tavernTab === 'downtime' ? 'bg-amber-100 dark:bg-amber-900/30 border-amber-500' : 'bg-slate-50 dark:bg-slate-800 border-transparent hover:border-amber-300'}`}
                  >
                    <Clock className="h-8 w-8 mx-auto mb-2 text-amber-600" />
                    <p className="text-sm font-medium">Downtime</p>
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
                          <Link href="/community?tab=find-a-game">
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
                        <Link href="/community?tab=find-a-game">
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
                    {(diceGame.sessionWins > 0 || diceGame.sessionLosses > 0) && (
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>Session: {diceGame.sessionWins}W / {diceGame.sessionLosses}L</span>
                        <span className={diceGame.sessionProfit >= 0 ? 'text-green-500' : 'text-red-500'}>
                          {diceGame.sessionProfit >= 0 ? '+' : ''}{diceGame.sessionProfit} gp
                        </span>
                        {diceGame.streak >= 3 && <span className="text-amber-500">Hot streak x{diceGame.streak}!</span>}
                        {diceGame.sessionProfit >= MAX_SESSION_PROFIT && (
                          <span className="text-red-500 font-medium">House limit reached!</span>
                        )}
                      </div>
                    )}
                    <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-slate-800 dark:to-emerald-900/20 border-green-200 dark:border-green-800/50">
                      <CardContent className="p-6">
                        {diceGame.gamePhase === 'betting' && (
                          <div className="space-y-4 text-center">
                            <p className="text-muted-foreground">You roll 5 dice, the house rolls 5 hidden. Guess how many of a face appear across all 10 dice. Riskier guesses pay more!</p>
                            <div className="flex items-center justify-center gap-4">
                              <span>Bet:</span>
                              <Input 
                                type="number"
                                min={1}
                                max={Math.min(MAX_BET, characterGold)}
                                value={diceGame.playerBet}
                                onChange={(e) => setDiceGame(prev => ({ ...prev, playerBet: Math.max(1, Math.min(MAX_BET, parseInt(e.target.value) || 1)) }))}
                                className="w-20"
                              />
                              <span className="text-yellow-600">gp</span>
                              <span className="text-xs text-muted-foreground">(max {MAX_BET})</span>
                            </div>
                            <p className="text-sm text-muted-foreground">Your gold: {characterGold} gp</p>
                            <Button 
                              onClick={startDiceGame}
                              disabled={!activeCharacter || characterGold < diceGame.playerBet || diceGame.sessionProfit >= MAX_SESSION_PROFIT}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              Roll the Dice!
                            </Button>
                          </div>
                        )}
                        
                        {diceGame.gamePhase === 'guessing' && (
                          <div className="space-y-4">
                            <div className="text-center">
                              <p className="font-medium mb-2">Your 3 Dice:</p>
                              <div className="flex justify-center gap-2 mb-4">
                                {diceGame.playerDice.map((die, i) => (
                                  <div key={i} className="w-10 h-10 bg-white dark:bg-slate-700 rounded-lg flex items-center justify-center text-xl font-bold border-2 border-amber-300">
                                    {['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'][die - 1]}
                                  </div>
                                ))}
                              </div>
                              <p className="text-sm text-muted-foreground mb-4">The house has 5 hidden dice. Guess how many total show a face (1s are wild)!</p>
                            </div>
                            <div className="flex items-center justify-center gap-4 flex-wrap">
                              <div className="flex items-center gap-2">
                                <span>At least</span>
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
                            {(() => {
                              const prob = calculateDiceOdds(diceGame.playerGuess.count, diceGame.playerGuess.face, diceGame.playerDice);
                              const payout = getPayoutMultiplier(prob);
                              const diff = getDifficultyLabel(prob);
                              const potentialWin = Math.floor(diceGame.playerBet * payout * HOUSE_EDGE) - diceGame.playerBet;
                              return (
                                <div className="text-center mt-3 space-y-1">
                                  <p className={`text-sm font-medium ${diff.color}`}>{diff.label} ({Math.round(prob * 100)}% chance)</p>
                                  <p className="text-xs text-muted-foreground">Payout: {payout}x | Potential win: <span className="text-green-500">+{potentialWin} gp</span></p>
                                </div>
                              );
                            })()}
                            <div className="flex justify-center mt-4">
                              <Button onClick={makeGuess} className="bg-amber-600 hover:bg-amber-700">Make My Guess!</Button>
                            </div>
                          </div>
                        )}
                        
                        {diceGame.gamePhase === 'result' && (
                          <div className="space-y-4 text-center">
                            <div className={`text-2xl font-bold ${diceGame.result === 'win' ? 'text-green-600' : 'text-red-600'}`}>
                              {diceGame.result === 'win' ? 'You Win!' : 'You Lose!'}
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
                              <p className="text-xs text-muted-foreground">
                                Total {diceGame.playerGuess.face}s + wilds: {[...diceGame.playerDice, ...diceGame.houseDice].filter(d => d === diceGame.playerGuess.face || d === 1).length}
                              </p>
                            </div>
                            <p className="text-lg">
                              {diceGame.result === 'win' 
                                ? <span className="text-green-600">+{diceGame.winnings} gold!</span>
                                : <span className="text-red-600">{diceGame.winnings} gold</span>
                              }
                            </p>
                            <Button onClick={resetDiceGame} variant="outline" disabled={diceGame.sessionProfit >= MAX_SESSION_PROFIT}>
                              {diceGame.sessionProfit >= MAX_SESSION_PROFIT ? "House Limit Reached" : "Play Again"}
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                )}

                {tavernTab === 'crafting' && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      <Hammer className="h-5 w-5 text-amber-600" />
                      Crafting Workshop
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Forge weapons, brew potions, and craft gear. Higher-level recipes require specific skills and tools in your inventory.
                      Roll a d20 + proficiency bonus against the recipe's DC. Failure consumes gold materials!
                    </p>

                    {!activeCharacter ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Lock className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <p>Select a character to access the workshop</p>
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-wrap gap-2 mb-4">
                          {["all", "Simple Weapon", "Martial Weapon", "Light Armor", "Medium Armor", "Heavy Armor", "Shield", "Potion", "Consumable", "Ammunition", "Adventuring Gear"].map(cat => (
                            <Button
                              key={cat}
                              size="sm"
                              variant={craftingFilter === cat ? "default" : "outline"}
                              onClick={() => setCraftingFilter(cat)}
                              className={craftingFilter === cat ? "bg-amber-600 hover:bg-amber-700" : ""}
                            >
                              {cat === "all" ? "All" : cat}
                            </Button>
                          ))}
                        </div>

                        {craftResult && (
                          <Card className={`border-2 ${craftResult.success ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : 'border-red-500 bg-red-50 dark:bg-red-900/20'}`}>
                            <CardContent className="p-4 text-center">
                              <p className="text-2xl font-bold mb-1">
                                {craftResult.success ? "Success!" : "Failed!"}
                              </p>
                              <p className="text-sm">
                                d20: {craftResult.roll}{craftResult.bonus > 0 ? ` + ${craftResult.bonus}` : ''} = {craftResult.total} vs DC {craftResult.dc}
                              </p>
                              {craftResult.success && craftResult.item && (
                                <p className="mt-2 text-green-700 dark:text-green-300 font-medium">
                                  Crafted: {craftResult.item.name}
                                </p>
                              )}
                              {!craftResult.success && (
                                <p className="mt-2 text-red-600 dark:text-red-400 text-xs">
                                  Materials worth {craftResult.goldSpent} gp were consumed.
                                </p>
                              )}
                              <Button size="sm" variant="ghost" onClick={() => setCraftResult(null)} className="mt-2">
                                <X className="h-3 w-3 mr-1" /> Dismiss
                              </Button>
                            </CardContent>
                          </Card>
                        )}

                        <div className="grid gap-3">
                          {(craftingRecipes as any[])
                            .filter((r: any) => craftingFilter === "all" || r.type === craftingFilter)
                            .map((recipe: any) => {
                              const charLevel = activeCharacter?.level || 1;
                              const meetsLevel = charLevel >= recipe.requiredLevel;
                              const charSkills: string[] = (activeCharacter as any)?.skills || [];
                              const meetsSkill = recipe.requiredSkills.length === 0 || recipe.requiredSkills.some((s: string) =>
                                charSkills.some((cs: string) => cs.toLowerCase().includes(s.toLowerCase()))
                              );
                              const charEquipment: any[] = (activeCharacter as any)?.equipment || [];
                              const meetsTool = recipe.requiredTools.length === 0 || recipe.requiredTools.every((tool: string) =>
                                charEquipment.some((item: any) => {
                                  let parsed = item;
                                  if (typeof parsed === 'string') {
                                    try { parsed = JSON.parse(parsed); } catch { parsed = { name: parsed }; }
                                  }
                                  return parsed.name && parsed.name.toLowerCase().includes(tool.toLowerCase());
                                })
                              );
                              const canAffordCraft = characterGold >= recipe.goldCost;
                              const canCraft = meetsLevel && meetsSkill && meetsTool && canAffordCraft;

                              return (
                                <Card key={recipe.id} className={`transition-all ${canCraft ? 'hover:shadow-md hover:border-amber-300' : 'opacity-60'}`}>
                                  <CardContent className="p-4">
                                    <div className="flex items-start justify-between">
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                          <span className="font-bold">{recipe.name}</span>
                                          <Badge variant="outline" className="text-xs">
                                            {recipe.rarity}
                                          </Badge>
                                          <Badge variant="outline" className="text-xs bg-blue-50 dark:bg-blue-900/20">
                                            DC {recipe.craftingDC}
                                          </Badge>
                                        </div>
                                        <p className="text-xs text-muted-foreground mb-2">{recipe.description}</p>
                                        <div className="flex flex-wrap gap-1 text-xs">
                                          <Badge className={`${meetsLevel ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'}`}>
                                            Lv {recipe.requiredLevel}+
                                          </Badge>
                                          {recipe.requiredSkills.length > 0 && (
                                            <Badge className={`${meetsSkill ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'}`}>
                                              {recipe.requiredSkills.join(" / ")}
                                            </Badge>
                                          )}
                                          {recipe.requiredTools.map((tool: string) => (
                                            <Badge key={tool} className={`${meetsTool ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'}`}>
                                              {tool}
                                            </Badge>
                                          ))}
                                          {recipe.goldCost > 0 && (
                                            <Badge className={`${canAffordCraft ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'}`}>
                                              <Coins className="h-3 w-3 mr-1" />
                                              {recipe.goldCost} gp
                                            </Badge>
                                          )}
                                        </div>
                                        {recipe.result.damage && (
                                          <p className="text-xs mt-1 text-orange-600">Damage: {recipe.result.damage}</p>
                                        )}
                                        {recipe.result.armor && (
                                          <p className="text-xs mt-1 text-blue-600">AC: {recipe.result.armor}</p>
                                        )}
                                      </div>
                                      <Button
                                        size="sm"
                                        disabled={!canCraft || craftMutation.isPending}
                                        onClick={() => craftMutation.mutate({ characterId: activeCharacter.id, recipeId: recipe.id })}
                                        className="bg-amber-600 hover:bg-amber-700 ml-3"
                                      >
                                        <Hammer className="h-3 w-3 mr-1" />
                                        {craftMutation.isPending ? "..." : "Craft"}
                                      </Button>
                                    </div>
                                  </CardContent>
                                </Card>
                              );
                            })}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Downtime Activities & Bounty Board */}
                {tavernTab === 'downtime' && (
                  <div className="space-y-6">
                    {/* Downtime Activities */}
                    <div>
                      <h3 className="text-lg font-bold flex items-center gap-2 mb-1">
                        <Clock className="h-5 w-5 text-amber-600" />
                        Downtime Activities
                      </h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Spend time between adventures earning gold. Each job is resolved by a skill check — better stats mean better pay, and risky work can backfire.
                      </p>
                      {!activeCharacter ? (
                        <div className="text-center py-6 text-muted-foreground">
                          <Clock className="h-10 w-10 mx-auto mb-2 opacity-40" />
                          <p>Select a character to begin downtime</p>
                        </div>
                      ) : (
                        <div className="grid gap-3">
                          {DOWNTIME_ACTIVITIES.map((activity) => {
                            const cooldownUntil = getActivityCooldown(activity.id);
                            const done = cooldownUntil > 0;
                            return (
                              <Card key={activity.id} className={`border transition-opacity ${done ? 'opacity-50' : ''}`}>
                                <CardContent className="p-4 flex items-center justify-between gap-3">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <p className="font-medium text-sm">{activity.name}</p>
                                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">{activity.skill}</span>
                                      {activity.risky && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">Risky</span>
                                      )}
                                    </div>
                                    <p className="text-xs text-muted-foreground">{activity.description}</p>
                                    <p className="text-xs text-amber-600 mt-1 font-medium">{activity.rewardRange}</p>
                                  </div>
                                  <Button
                                    size="sm"
                                    disabled={done || downtimeMutation.isPending}
                                    onClick={() => performDowntime(activity)}
                                    className={done ? '' : 'bg-amber-600 hover:bg-amber-700'}
                                    variant={done ? 'outline' : 'default'}
                                  >
                                    {done ? <><Clock className="h-3 w-3 mr-1" />{formatCooldown(cooldownUntil)}</> : 'Work'}
                                  </Button>
                                </CardContent>
                              </Card>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <Separator />

                    {/* Bounty Board */}
                    <div>
                      <h3 className="text-lg font-bold flex items-center gap-2 mb-1">
                        <Scroll className="h-5 w-5 text-amber-600" />
                        Bounty Board
                      </h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Wanted contracts posted by guilds and town guards. Hunting a target is a real fight — your combat stats vs theirs. Win and collect; lose and you crawl home wounded and exhausted.
                      </p>
                      {!activeCharacter ? (
                        <div className="text-center py-6 text-muted-foreground">
                          <Scroll className="h-10 w-10 mx-auto mb-2 opacity-40" />
                          <p>Select a character to view bounties</p>
                        </div>
                      ) : (
                        <div className="grid gap-3">
                          {bounties.map((bounty) => {
                            const difficultyColors: Record<string, string> = {
                              Easy: 'border-green-300 dark:border-green-700',
                              Moderate: 'border-yellow-300 dark:border-yellow-700',
                              Challenging: 'border-orange-300 dark:border-orange-700',
                              Deadly: 'border-red-400 dark:border-red-700',
                            };
                            const badgeColors: Record<string, string> = {
                              Easy: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
                              Moderate: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
                              Challenging: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
                              Deadly: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
                            };
                            const completed = bounty.state === 'completed';
                            const onCooldown = bounty.state === 'cooldown';
                            const disabled = completed || onCooldown || huntMutation.isPending;
                            const cooldownLabel = bounty.cooldownUntil ? formatCooldown(Date.parse(bounty.cooldownUntil)) : '';
                            return (
                              <Card key={bounty.id} className={`border-2 transition-opacity ${completed || onCooldown ? 'opacity-50' : difficultyColors[bounty.difficulty] || ''}`}>
                                <CardContent className="p-4 flex items-start gap-3">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                      <p className="font-medium text-sm">{bounty.target}</p>
                                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badgeColors[bounty.difficulty] || ''}`}>{bounty.difficulty}</span>
                                      <span className="text-[10px] text-muted-foreground">CR {bounty.cr} · Lv {bounty.recommendedLevel}</span>
                                    </div>
                                    <p className="text-xs text-muted-foreground">{bounty.description}</p>
                                    <p className="text-xs text-amber-600 mt-1 font-bold">Reward: {bounty.reward} gp</p>
                                  </div>
                                  <Button
                                    size="sm"
                                    disabled={disabled}
                                    onClick={() => huntBounty(bounty.id)}
                                    className={completed || onCooldown ? '' : 'bg-red-700 hover:bg-red-800 shrink-0'}
                                    variant={completed || onCooldown ? 'outline' : 'default'}
                                  >
                                    {completed ? <><Check className="h-3 w-3 mr-1" />Slain</>
                                      : onCooldown ? <><Clock className="h-3 w-3 mr-1" />{cooldownLabel}</>
                                      : 'Hunt'}
                                  </Button>
                                </CardContent>
                              </Card>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Hunt result */}
                    <Dialog open={!!huntResult} onOpenChange={(open) => { if (!open) setHuntResult(null); }}>
                      <DialogContent className="max-w-md">
                        <DialogHeader>
                          <DialogTitle className={huntResult?.victory ? 'text-amber-600' : 'text-red-600'}>
                            {huntResult?.victory ? 'Bounty Collected!' : 'Hunt Failed'}
                          </DialogTitle>
                          <DialogDescription>{huntResult?.summary}</DialogDescription>
                        </DialogHeader>
                        {huntResult && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">{huntResult.enemy.name} (CR {huntResult.enemy.cr})</span>
                              <span>HP {huntResult.hpStart} → {huntResult.hpEnd}</span>
                            </div>
                            <div className="max-h-56 overflow-y-auto rounded-md border bg-muted/30 p-2 text-xs space-y-0.5 font-mono">
                              {huntResult.log.map((line, i) => (<p key={i}>{line}</p>))}
                            </div>
                            {huntResult.victory
                              ? <p className="text-sm font-medium text-amber-600">+{huntResult.goldEarned} gp</p>
                              : <p className="text-sm font-medium text-red-600">No reward.{huntResult.exhaustionGained ? ' +1 exhaustion.' : ''} Recover before trying again.</p>}
                          </div>
                        )}
                        <DialogFooter>
                          <Button onClick={() => setHuntResult(null)}>Close</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </SidebarTabs>

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
