import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Character, insertCharacterSchema } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { generateCharacterSuggestion } from "@/lib/openai";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import CharacterSheet from "@/components/character/CharacterSheet";
import { AlertCircle, Plus, User, Users, Dice6, Swords, Sparkles, Sword, Wand2, Shield, Heart, Flame, Moon, Loader2, ChevronDown, ChevronUp, Zap, Package, Scroll, Edit, Trash2, HelpCircle, BookOpen, Target, Brain, Eye } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import parchmentFrame from "@assets/image_1768600727955.png";

// Race info with traits and advantages
const raceInfo: Record<string, { traits: string; advantages: string; bestFor: string }> = {
  "Human": {
    traits: "+1 to all ability scores, Extra language, Extra skill",
    advantages: "Most versatile race. Fits any class well.",
    bestFor: "Any class - great for beginners"
  },
  "Elf": {
    traits: "+2 DEX, Darkvision, Fey Ancestry (charm resist), Trance (4hr rest)",
    advantages: "Graceful and perceptive. Immune to sleep magic.",
    bestFor: "Ranger, Rogue, Wizard"
  },
  "Dwarf": {
    traits: "+2 CON, Darkvision, Poison resistance, Stonecunning",
    advantages: "Hardy and resilient. Extra HP and poison resist.",
    bestFor: "Fighter, Cleric, Paladin"
  },
  "Halfling": {
    traits: "+2 DEX, Lucky (reroll 1s), Brave (fear resist), Nimble",
    advantages: "Lucky trait is powerful. Can move through larger creatures.",
    bestFor: "Rogue, Bard, Ranger"
  },
  "Dragonborn": {
    traits: "+2 STR, +1 CHA, Breath Weapon, Damage Resistance",
    advantages: "Built-in AoE attack. Resistance to your dragon type's element.",
    bestFor: "Paladin, Fighter, Sorcerer"
  },
  "Gnome": {
    traits: "+2 INT, Darkvision, Gnome Cunning (magic save advantage)",
    advantages: "Excellent magic resistance. Great for casters.",
    bestFor: "Wizard, Artificer, Bard"
  },
  "Half-Elf": {
    traits: "+2 CHA, +1 to two others, Darkvision, Fey Ancestry, 2 skills",
    advantages: "Extremely versatile. Extra skills and flexible stats.",
    bestFor: "Bard, Warlock, Paladin, Sorcerer"
  },
  "Half-Orc": {
    traits: "+2 STR, +1 CON, Darkvision, Relentless Endurance, Savage Attacks",
    advantages: "Can drop to 1 HP instead of 0 once. Extra crit damage.",
    bestFor: "Barbarian, Fighter, Paladin"
  },
  "Tiefling": {
    traits: "+2 CHA, +1 INT, Darkvision, Fire resistance, Infernal Legacy spells",
    advantages: "Free spells and fire resistance. Great for face characters.",
    bestFor: "Warlock, Sorcerer, Bard, Paladin"
  }
};

// Class info with role and key features
const classInfo: Record<string, { role: string; hitDie: string; primaryStat: string; features: string; playstyle: string }> = {
  "Barbarian": {
    role: "Melee Damage Dealer / Tank",
    hitDie: "d12 (highest HP)",
    primaryStat: "Strength, Constitution",
    features: "Rage (damage resist + bonus), Reckless Attack, Danger Sense",
    playstyle: "Rush into combat, absorb hits, deal massive damage"
  },
  "Bard": {
    role: "Support / Face / Jack-of-all-trades",
    hitDie: "d8",
    primaryStat: "Charisma",
    features: "Bardic Inspiration, Spellcasting, Jack of All Trades, Expertise",
    playstyle: "Buff allies, control battlefield, excel at social encounters"
  },
  "Cleric": {
    role: "Healer / Support / Divine Caster",
    hitDie: "d8",
    primaryStat: "Wisdom",
    features: "Divine Domain powers, Channel Divinity, Full spellcasting, Armor",
    playstyle: "Heal and buff allies, can fight in melee with armor"
  },
  "Druid": {
    role: "Spellcaster / Shapeshifter",
    hitDie: "d8",
    primaryStat: "Wisdom",
    features: "Wild Shape (become animals), Nature spellcasting, Circle features",
    playstyle: "Control nature, transform into beasts, versatile spellcasting"
  },
  "Fighter": {
    role: "Martial Combat Expert",
    hitDie: "d10",
    primaryStat: "Strength or Dexterity",
    features: "Fighting Style, Action Surge, Extra Attacks (up to 4), Second Wind",
    playstyle: "Master of weapons and armor. Most attacks per turn."
  },
  "Monk": {
    role: "Mobile Striker / Martial Artist",
    hitDie: "d8",
    primaryStat: "Dexterity, Wisdom",
    features: "Martial Arts, Ki points, Unarmored Defense, Stunning Strike",
    playstyle: "Fast, mobile, stun enemies, deflect missiles"
  },
  "Paladin": {
    role: "Holy Warrior / Tank / Support",
    hitDie: "d10",
    primaryStat: "Strength, Charisma",
    features: "Divine Smite, Lay on Hands healing, Aura of Protection, Spells",
    playstyle: "Smite evil, protect allies, heal, wear heavy armor"
  },
  "Ranger": {
    role: "Ranged Striker / Scout",
    hitDie: "d10",
    primaryStat: "Dexterity, Wisdom",
    features: "Favored Enemy, Natural Explorer, Fighting Style, Spellcasting",
    playstyle: "Track enemies, fight at range, wilderness survival expert"
  },
  "Rogue": {
    role: "Skill Expert / Burst Damage",
    hitDie: "d8",
    primaryStat: "Dexterity",
    features: "Sneak Attack, Expertise, Cunning Action, Evasion, Uncanny Dodge",
    playstyle: "Strike from shadows, massive single-target damage, skill master"
  },
  "Sorcerer": {
    role: "Arcane Blaster / Metamagic User",
    hitDie: "d6",
    primaryStat: "Charisma",
    features: "Sorcery Points, Metamagic (modify spells), Innate spellcasting",
    playstyle: "Fewer spells but can enhance them. Twin/Quicken/Subtle spells."
  },
  "Warlock": {
    role: "Eldritch Blaster / Pact Caster",
    hitDie: "d8",
    primaryStat: "Charisma",
    features: "Pact Magic (short rest slots), Eldritch Invocations, Pact Boon",
    playstyle: "Fewer slots but recover on short rest. Powerful Eldritch Blast."
  },
  "Wizard": {
    role: "Arcane Scholar / Utility Caster",
    hitDie: "d6 (lowest)",
    primaryStat: "Intelligence",
    features: "Spellbook, Arcane Recovery, School specialization, Most spell variety",
    playstyle: "Largest spell list. Prepare different spells daily. Very versatile."
  }
};

// Alignment info with description and roleplay guidance
const alignmentInfo: Record<string, { description: string; examples: string; roleplayTip: string }> = {
  "Lawful Good": {
    description: "Follows rules and does what's right. Honor and justice above all.",
    examples: "Paladins, noble knights, honest guards, righteous clerics",
    roleplayTip: "You believe society's laws exist to protect the innocent"
  },
  "Neutral Good": {
    description: "Does good without bias toward law or chaos. Follows their conscience.",
    examples: "Healers, helpful druids, kind commoners, benevolent rulers",
    roleplayTip: "You help others because it's right, not because rules say so"
  },
  "Chaotic Good": {
    description: "Values freedom and kindness. Rebels against tyranny for good causes.",
    examples: "Robin Hood types, freedom fighters, kind rogues, wild heroes",
    roleplayTip: "You fight for the little guy and hate bullies and tyrants"
  },
  "Lawful Neutral": {
    description: "Order and organization matter most. Follows codes strictly.",
    examples: "Judges, monks, soldiers following orders, bureaucrats",
    roleplayTip: "You believe structure prevents chaos, regardless of good or evil"
  },
  "True Neutral": {
    description: "Maintains balance or simply doesn't pick sides. Acts situationally.",
    examples: "Druids of balance, unaligned wanderers, pragmatic merchants",
    roleplayTip: "You see all sides and act based on circumstances"
  },
  "Chaotic Neutral": {
    description: "Values personal freedom above all. Unpredictable but not malicious.",
    examples: "Free-spirited wanderers, wild mages, selfish but not evil rogues",
    roleplayTip: "You do what you want when you want, consequences be damned"
  },
  "Lawful Evil": {
    description: "Uses rules and systems to gain power. Organized villainy.",
    examples: "Tyrants, corrupt officials, crime lords, evil clerics",
    roleplayTip: "You exploit laws to dominate others. Order serves your ambition."
  },
  "Neutral Evil": {
    description: "Purely selfish. Does whatever they can get away with.",
    examples: "Mercenaries, assassins, selfish schemers, traitors",
    roleplayTip: "You look out for yourself first. Allies are tools."
  },
  "Chaotic Evil": {
    description: "Destructive and unpredictable. Revels in chaos and suffering.",
    examples: "Demons, mad cultists, brutal warlords, sadistic villains",
    roleplayTip: "You destroy because you can. Rules are for the weak."
  }
};

// D&D standard ability score rolling: 4d6 drop lowest
function roll4d6DropLowest(): number {
  const rolls = Array.from({ length: 4 }, () => Math.floor(Math.random() * 6) + 1);
  rolls.sort((a, b) => a - b);
  // Remove the lowest roll and sum the remaining 3
  return rolls.slice(1).reduce((sum, roll) => sum + roll, 0);
}

// Generate a full set of ability scores using 4d6 drop lowest
function rollAbilityScores(): { strength: number; dexterity: number; constitution: number; intelligence: number; wisdom: number; charisma: number } {
  return {
    strength: roll4d6DropLowest(),
    dexterity: roll4d6DropLowest(),
    constitution: roll4d6DropLowest(),
    intelligence: roll4d6DropLowest(),
    wisdom: roll4d6DropLowest(),
    charisma: roll4d6DropLowest(),
  };
}

const buildArchetypes = [
  {
    id: "frontline",
    name: "Frontline Protector",
    icon: Shield,
    color: "from-red-500 to-orange-500",
    summary: "You protect allies and absorb damage",
    classes: ["Fighter", "Barbarian", "Paladin"],
    keyStats: "Strength or Dexterity, Constitution",
    playstyle: "Stand between enemies and your party. Use heavy armor and high HP to tank hits.",
    tip: "Prioritize Constitution for more HP. Fighters get the most attacks, Barbarians rage for damage resistance, Paladins heal and smite."
  },
  {
    id: "striker",
    name: "Precision Striker",
    icon: Target,
    color: "from-slate-500 to-zinc-600",
    summary: "You deal massive single-target damage",
    classes: ["Rogue", "Ranger", "Monk"],
    keyStats: "Dexterity, then Wisdom or Intelligence",
    playstyle: "Find weak spots and exploit them. Use positioning, stealth, or mobility to get advantage.",
    tip: "Rogues deal Sneak Attack damage when they have advantage. Rangers excel at range. Monks can stun enemies."
  },
  {
    id: "arcane",
    name: "Arcane Power",
    icon: Wand2,
    color: "from-purple-500 to-indigo-500",
    summary: "You control the battlefield with magic",
    classes: ["Wizard", "Sorcerer", "Warlock"],
    keyStats: "Intelligence (Wizard) or Charisma (Sorcerer/Warlock)",
    playstyle: "Stay safe at range. Use spells to control crowds, deal area damage, or buff allies.",
    tip: "Wizards have the most spell variety. Sorcerers can modify spells. Warlocks recharge on short rests."
  },
  {
    id: "support",
    name: "Divine Support",
    icon: Heart,
    color: "from-cyan-500 to-blue-500",
    summary: "You heal, buff, and protect the party",
    classes: ["Cleric", "Druid", "Bard"],
    keyStats: "Wisdom (Cleric/Druid) or Charisma (Bard)",
    playstyle: "Keep allies alive and enhance their abilities. Remove conditions and provide utility.",
    tip: "Clerics are the best healers. Druids can shapeshift. Bards inspire allies and have great skills."
  },
  {
    id: "versatile",
    name: "Versatile Adventurer",
    icon: Brain,
    color: "from-emerald-500 to-teal-500",
    summary: "You adapt to any situation",
    classes: ["Bard", "Ranger", "Paladin"],
    keyStats: "Varies by class - usually Charisma or Dexterity",
    playstyle: "Fill gaps in the party. Switch between combat, support, and utility as needed.",
    tip: "These classes can do a bit of everything. Great for small parties or if you like flexibility."
  }
];

const characterTemplates = [
  {
    id: "warrior",
    name: "Brave Warrior",
    class: "Fighter",
    race: "Human",
    icon: Sword,
    color: "from-red-500 to-orange-500",
    description: "A courageous fighter skilled in combat",
    stats: { strength: 16, dexterity: 12, constitution: 14, intelligence: 10, wisdom: 11, charisma: 10 }
  },
  {
    id: "wizard",
    name: "Wise Wizard",
    class: "Wizard",
    race: "Elf",
    icon: Wand2,
    color: "from-purple-500 to-indigo-500",
    description: "A master of arcane magic and ancient lore",
    stats: { strength: 8, dexterity: 12, constitution: 12, intelligence: 16, wisdom: 14, charisma: 10 }
  },
  {
    id: "paladin",
    name: "Holy Paladin",
    class: "Paladin",
    race: "Human",
    icon: Shield,
    color: "from-yellow-500 to-amber-500",
    description: "A divine warrior guided by righteousness",
    stats: { strength: 15, dexterity: 10, constitution: 13, intelligence: 10, wisdom: 12, charisma: 14 }
  },
  {
    id: "rogue",
    name: "Cunning Rogue",
    class: "Rogue",
    race: "Halfling",
    icon: Moon,
    color: "from-slate-500 to-zinc-600",
    description: "A stealthy trickster with quick reflexes",
    stats: { strength: 10, dexterity: 16, constitution: 12, intelligence: 13, wisdom: 11, charisma: 12 }
  },
  {
    id: "cleric",
    name: "Divine Cleric",
    class: "Cleric",
    race: "Dwarf",
    icon: Heart,
    color: "from-cyan-500 to-blue-500",
    description: "A healer blessed with divine power",
    stats: { strength: 13, dexterity: 10, constitution: 14, intelligence: 11, wisdom: 16, charisma: 10 }
  },
  {
    id: "sorcerer",
    name: "Wild Sorcerer",
    class: "Sorcerer",
    race: "Tiefling",
    icon: Flame,
    color: "from-pink-500 to-rose-600",
    description: "Born with innate magical abilities",
    stats: { strength: 8, dexterity: 12, constitution: 13, intelligence: 11, wisdom: 10, charisma: 16 }
  }
];

// Extended schema with validation rules - userId is handled by backend from auth
const createCharacterSchema = insertCharacterSchema.omit({ userId: true }).extend({
  name: z.string().min(2, "Name must be at least 2 characters"),
  race: z.string().min(1, "Please select a race"),
  class: z.string().min(1, "Please select a class"),
  strength: z.number().min(3).max(20),
  dexterity: z.number().min(3).max(20),
  constitution: z.number().min(3).max(20),
  intelligence: z.number().min(3).max(20),
  wisdom: z.number().min(3).max(20),
  charisma: z.number().min(3).max(20),
});

type FormValues = z.infer<typeof createCharacterSchema>;

const races = [
  "Human", "Elf", "Dwarf", "Halfling", "Dragonborn", 
  "Gnome", "Half-Elf", "Half-Orc", "Tiefling"
];

const classes = [
  "Barbarian", "Bard", "Cleric", "Druid", "Fighter", 
  "Monk", "Paladin", "Ranger", "Rogue", "Sorcerer", "Warlock", "Wizard"
];

const alignments = [
  "Lawful Good", "Neutral Good", "Chaotic Good",
  "Lawful Neutral", "True Neutral", "Chaotic Neutral",
  "Lawful Evil", "Neutral Evil", "Chaotic Evil"
];

const backgrounds = [
  "Acolyte", "Charlatan", "Criminal", "Entertainer", 
  "Folk Hero", "Guild Artisan", "Hermit", "Noble", 
  "Outlander", "Sage", "Sailor", "Soldier", "Urchin"
];

export default function Characters() {
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  const [expandedCharacterId, setExpandedCharacterId] = useState<number | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [isCreatingFromTemplate, setIsCreatingFromTemplate] = useState(false);
  const [generatingPortraitIds, setGeneratingPortraitIds] = useState<Set<number>>(new Set());
  const [showBuildGuidance, setShowBuildGuidance] = useState(false);
  const [selectedArchetype, setSelectedArchetype] = useState<string | null>(null);
  
  const { toast } = useToast();
  
  // Mutation to generate portrait for a character
  const generatePortraitMutation = useMutation({
    mutationFn: async (characterId: number) => {
      const response = await apiRequest("POST", `/api/characters/${characterId}/generate-portrait`);
      return response.json();
    },
    onSuccess: (data, characterId) => {
      queryClient.invalidateQueries({ queryKey: ['/api/characters'] });
      setGeneratingPortraitIds(prev => {
        const next = new Set(prev);
        next.delete(characterId);
        return next;
      });
    },
    onError: (error: Error, characterId) => {
      setGeneratingPortraitIds(prev => {
        const next = new Set(prev);
        next.delete(characterId);
        return next;
      });
      toast({
        title: "Portrait Generation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Auto-generate portrait for character if missing
  const generatePortraitIfMissing = (character: Character) => {
    if (!character.portraitUrl && !generatingPortraitIds.has(character.id)) {
      setGeneratingPortraitIds(prev => new Set(prev).add(character.id));
      generatePortraitMutation.mutate(character.id);
    }
  };
  
  const { data: characters, isLoading } = useQuery<Character[]>({
    queryKey: ['/api/characters'],
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(createCharacterSchema),
    defaultValues: {
      name: "",
      race: "",
      class: "",
      level: 1,
      background: "",
      alignment: "",
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
      hitPoints: 10,
      maxHitPoints: 10,
      armorClass: 10,
      skills: [],
      equipment: [],
      createdAt: new Date().toISOString(),
    },
  });

  const createCharacter = useMutation({
    mutationFn: async (data: FormValues) => {
      const response = await apiRequest("POST", "/api/characters", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/characters'] });
      toast({
        title: "Character Created",
        description: "Your character has been successfully created.",
      });
      form.reset();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create character. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteCharacter = useMutation({
    mutationFn: async (characterId: number) => {
      const response = await apiRequest("DELETE", `/api/characters/${characterId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/characters'] });
      toast({
        title: "Character Deleted",
        description: "Your character has been removed.",
      });
      setExpandedCharacterId(null);
      setSelectedCharacter(null);
    },
    onError: (error: any) => {
      toast({
        title: "Cannot Delete Character",
        description: error.message || "This character may be participating in active campaigns.",
        variant: "destructive",
      });
    },
  });

  const createFromTemplate = async (templateId: string) => {
    const template = characterTemplates.find(t => t.id === templateId);
    if (!template) return;
    
    setIsCreatingFromTemplate(true);
    try {
      const hp = 10 + Math.floor((template.stats.constitution - 10) / 2);
      const ac = 10 + Math.floor((template.stats.dexterity - 10) / 2);
      
      const characterData = {
        name: `${template.name.split(" ")[0]} the ${template.class}`,
        race: template.race,
        class: template.class,
        level: 1,
        background: "Folk Hero",
        alignment: "Neutral Good",
        strength: template.stats.strength,
        dexterity: template.stats.dexterity,
        constitution: template.stats.constitution,
        intelligence: template.stats.intelligence,
        wisdom: template.stats.wisdom,
        charisma: template.stats.charisma,
        hitPoints: hp,
        maxHitPoints: hp,
        armorClass: ac,
        skills: [],
        equipment: [],
        createdAt: new Date().toISOString(),
      };
      
      const response = await apiRequest("POST", "/api/characters", characterData);
      const character = await response.json();
      
      queryClient.invalidateQueries({ queryKey: ['/api/characters'] });
      setSelectedCharacter(character);
      toast({
        title: "Hero Created!",
        description: `${character.name} is ready for adventure.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create character. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCreatingFromTemplate(false);
      setSelectedTemplate(null);
    }
  };

  const handleGenerateCharacter = async () => {
    try {
      setIsGenerating(true);
      const prompt = "Generate a unique and interesting D&D character with a compelling backstory";
      const suggestion = await generateCharacterSuggestion(prompt);
      
      // Parse ability scores from the suggestion
      const abilities = {
        strength: Math.floor(Math.random() * 10) + 8,
        dexterity: Math.floor(Math.random() * 10) + 8,
        constitution: Math.floor(Math.random() * 10) + 8,
        intelligence: Math.floor(Math.random() * 10) + 8,
        wisdom: Math.floor(Math.random() * 10) + 8,
        charisma: Math.floor(Math.random() * 10) + 8,
      };
      
      // Calculate hit points based on class and constitution
      const baseHp = getBaseHitPoints(suggestion.class);
      const conModifier = Math.floor((abilities.constitution - 10) / 2);
      const maxHp = baseHp + conModifier;
      
      form.reset({
        ...form.getValues(),
        name: suggestion.name,
        race: suggestion.race,
        class: suggestion.class,
        background: suggestion.background,
        alignment: suggestion.alignment,
        strength: abilities.strength,
        dexterity: abilities.dexterity,
        constitution: abilities.constitution,
        intelligence: abilities.intelligence,
        wisdom: abilities.wisdom,
        charisma: abilities.charisma,
        hitPoints: maxHp,
        maxHitPoints: maxHp,
        armorClass: 10 + Math.floor((abilities.dexterity - 10) / 2),
      });
      
      toast({
        title: "Character Generated",
        description: "A new character concept has been generated. You can modify it before saving.",
      });
    } catch (error) {
      toast({
        title: "Generation Failed",
        description: "Failed to generate character suggestion.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  function getBaseHitPoints(characterClass: string): number {
    // Base hit points by class at level 1
    const hitDiceByClass: Record<string, number> = {
      Barbarian: 12,
      Fighter: 10,
      Paladin: 10,
      Ranger: 10,
      Monk: 8,
      Rogue: 8,
      Bard: 8,
      Cleric: 8,
      Druid: 8,
      Warlock: 8,
      Wizard: 6,
      Sorcerer: 6,
    };
    
    return hitDiceByClass[characterClass] || 8;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Hero Section - Matching Groups page style */}
      <div className="container mx-auto px-4 py-8">
        <section className="relative overflow-hidden rounded-xl bg-gradient-to-br from-amber-900/40 via-orange-900/30 to-slate-900/40 border border-amber-500/20 p-8 mb-8">
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
          {/* Fantasy decorative icons */}
          <div className="absolute top-4 right-8 opacity-15">
            <User className="h-20 w-20 text-amber-400" />
          </div>
          <div className="absolute top-12 right-24 opacity-10">
            <Swords className="h-16 w-16 text-orange-300 rotate-12" />
          </div>
          
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm">
                <Users className="h-3 w-3" />
                <span>Build Your Party</span>
              </div>
            </div>
            <h1 className="text-2xl md:text-3xl font-fantasy font-bold text-white mb-2">Your Heroes</h1>
            <p className="text-white/60">Create and manage your adventurers</p>
          </div>
        </section>
      </div>
      
      <div className="container mx-auto px-4 pb-8">
      <Tabs defaultValue="list">
        <TabsList className="mb-6">
          <TabsTrigger value="list" className="flex items-center gap-2">
            <User size={16} />
            My Characters
          </TabsTrigger>
          <TabsTrigger value="quick" className="flex items-center gap-2">
            <Sparkles size={16} />
            Quick Create
          </TabsTrigger>
          <TabsTrigger value="create" className="flex items-center gap-2">
            <Plus size={16} />
            Advanced
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="list">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader>
                    <div className="h-6 bg-gray-300 rounded w-3/4"></div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="h-4 bg-gray-300 rounded w-1/2"></div>
                      <div className="h-4 bg-gray-300 rounded w-2/3"></div>
                      <div className="h-4 bg-gray-300 rounded w-3/4"></div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : characters && characters.length > 0 ? (
            <div className="space-y-4">
              {/* Generate All Missing Portraits Button */}
              {characters.some(c => !c.portraitUrl) && (
                <div className="flex justify-end mb-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      characters
                        .filter(c => !c.portraitUrl && !generatingPortraitIds.has(c.id))
                        .forEach(c => generatePortraitIfMissing(c));
                    }}
                    disabled={generatingPortraitIds.size > 0}
                    className="flex items-center gap-2 bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20"
                  >
                    <Sparkles className="h-4 w-4" />
                    {generatingPortraitIds.size > 0 
                      ? `Generating ${generatingPortraitIds.size} portrait${generatingPortraitIds.size > 1 ? 's' : ''}...` 
                      : `Generate All Portraits (${characters.filter(c => !c.portraitUrl).length} missing)`
                    }
                  </Button>
                </div>
              )}
              {characters.map((character) => {
                const isExpanded = expandedCharacterId === character.id;
                return (
                  <Card 
                    key={character.id} 
                    className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-slate-800 dark:to-slate-900 border-2 border-amber-200 dark:border-amber-800/50"
                  >
                    <CardContent className="py-4">
                      {/* Compact Stats Bar - Same as Dashboard */}
                      <div className="flex items-center justify-between flex-wrap gap-4">
                        <div className="flex items-center gap-4">
                          <div 
                            className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center overflow-hidden relative cursor-pointer"
                            onClick={() => !character.portraitUrl && generatePortraitIfMissing(character)}
                            title={!character.portraitUrl ? "Click to generate portrait" : character.name}
                          >
                            {character.portraitUrl ? (
                              <img 
                                src={character.portraitUrl} 
                                alt={character.name}
                                className="w-full h-full object-cover"
                              />
                            ) : generatingPortraitIds.has(character.id) ? (
                              <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                            ) : (
                              <User className="h-6 w-6 text-white" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className={`font-fantasy text-lg font-bold ${character.status === 'dead' ? 'text-gray-500 dark:text-gray-400 line-through' : 'text-amber-900 dark:text-amber-100'}`}>{character.name}</h3>
                              {character.status === 'dead' && (
                                <Badge variant="destructive" className="text-xs">DEAD</Badge>
                              )}
                              {character.status === 'unconscious' && (
                                <Badge variant="outline" className="text-xs border-red-500 text-red-600">Unconscious</Badge>
                              )}
                            </div>
                            <p className="text-sm text-amber-700 dark:text-amber-300">
                              Level {character.level} {character.race} {character.class}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-6">
                          {/* Core Stats */}
                          <div className="flex gap-3">
                            <div className="text-center px-3 py-1 bg-red-100 dark:bg-red-900/30 rounded-lg">
                              <p className="text-xs text-red-600 dark:text-red-400">HP</p>
                              <p className="font-bold text-red-700 dark:text-red-300">{character.hitPoints || 0}/{character.maxHitPoints || 0}</p>
                            </div>
                            <div className="text-center px-3 py-1 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                              <p className="text-xs text-blue-600 dark:text-blue-400">AC</p>
                              <p className="font-bold text-blue-700 dark:text-blue-300">{character.armorClass || 10}</p>
                            </div>
                          </div>
                          
                          {/* Ability Scores - Compact */}
                          <div className="hidden md:flex gap-2">
                            {[
                              { name: 'STR', value: character.strength || 10 },
                              { name: 'DEX', value: character.dexterity || 10 },
                              { name: 'CON', value: character.constitution || 10 },
                              { name: 'INT', value: character.intelligence || 10 },
                              { name: 'WIS', value: character.wisdom || 10 },
                              { name: 'CHA', value: character.charisma || 10 },
                            ].map(stat => (
                              <div key={stat.name} className="text-center px-2 py-1 bg-white/50 dark:bg-slate-700/50 rounded">
                                <p className="text-xs text-muted-foreground">{stat.name}</p>
                                <p className="font-bold text-sm">{stat.value}</p>
                              </div>
                            ))}
                          </div>
                          
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setExpandedCharacterId(isExpanded ? null : character.id)}
                            className="flex items-center gap-1"
                          >
                            {isExpanded ? (
                              <>
                                <ChevronUp className="h-4 w-4" />
                                Collapse
                              </>
                            ) : (
                              <>
                                <ChevronDown className="h-4 w-4" />
                                Full Sheet
                              </>
                            )}
                          </Button>
                        </div>
                      </div>

                      {/* Expanded Character Sheet - Same as Dashboard */}
                      {isExpanded && (
                        <div className="mt-6 pt-6 border-t border-amber-200 dark:border-amber-800/50">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* Left Column - Character Details & Ability Scores */}
                            <div className="space-y-4">
                              <div className="bg-white/50 dark:bg-slate-700/50 rounded-lg p-4">
                                <h4 className="font-fantasy text-sm font-bold text-amber-800 dark:text-amber-200 mb-3 flex items-center gap-2">
                                  <User className="h-4 w-4" />
                                  Character Details
                                </h4>
                                <div className="space-y-2 text-sm">
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Race:</span>
                                    <span className="font-medium">{character.race}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Class:</span>
                                    <span className="font-medium">{character.class}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Level:</span>
                                    <span className="font-medium">{character.level}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">XP:</span>
                                    <span className="font-medium">{character.experience || 0}</span>
                                  </div>
                                </div>
                              </div>

                              <div className="bg-white/50 dark:bg-slate-700/50 rounded-lg p-4">
                                <h4 className="font-fantasy text-sm font-bold text-amber-800 dark:text-amber-200 mb-3 flex items-center gap-2">
                                  <Zap className="h-4 w-4" />
                                  Ability Scores
                                </h4>
                                <div className="grid grid-cols-2 gap-2">
                                  {[
                                    { name: 'Strength', abbr: 'STR', value: character.strength || 10 },
                                    { name: 'Dexterity', abbr: 'DEX', value: character.dexterity || 10 },
                                    { name: 'Constitution', abbr: 'CON', value: character.constitution || 10 },
                                    { name: 'Intelligence', abbr: 'INT', value: character.intelligence || 10 },
                                    { name: 'Wisdom', abbr: 'WIS', value: character.wisdom || 10 },
                                    { name: 'Charisma', abbr: 'CHA', value: character.charisma || 10 },
                                  ].map(stat => {
                                    const modifier = Math.floor((stat.value - 10) / 2);
                                    const modifierStr = modifier >= 0 ? `+${modifier}` : `${modifier}`;
                                    return (
                                      <div key={stat.abbr} className="text-center p-2 bg-amber-100/50 dark:bg-amber-900/30 rounded">
                                        <p className="text-xs text-muted-foreground">{stat.abbr}</p>
                                        <p className="font-bold text-lg">{stat.value}</p>
                                        <p className="text-xs text-amber-600 dark:text-amber-400">({modifierStr})</p>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>

                            {/* Middle Column - Combat Stats */}
                            <div className="space-y-4">
                              <div className="bg-white/50 dark:bg-slate-700/50 rounded-lg p-4">
                                <h4 className="font-fantasy text-sm font-bold text-amber-800 dark:text-amber-200 mb-3 flex items-center gap-2">
                                  <Heart className="h-4 w-4" />
                                  Combat Stats
                                </h4>
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="text-center p-3 bg-red-100 dark:bg-red-900/30 rounded-lg">
                                    <p className="text-xs text-red-600 dark:text-red-400">Hit Points</p>
                                    <p className="font-bold text-xl text-red-700 dark:text-red-300">
                                      {character.hitPoints || 0}/{character.maxHitPoints || 0}
                                    </p>
                                  </div>
                                  <div className="text-center p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                                    <p className="text-xs text-blue-600 dark:text-blue-400">Armor Class</p>
                                    <p className="font-bold text-xl text-blue-700 dark:text-blue-300">{character.armorClass || 10}</p>
                                  </div>
                                  <div className="text-center p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                                    <p className="text-xs text-purple-600 dark:text-purple-400">Initiative</p>
                                    <p className="font-bold text-xl text-purple-700 dark:text-purple-300">
                                      {(() => {
                                        const dexMod = Math.floor(((character.dexterity || 10) - 10) / 2);
                                        return dexMod >= 0 ? `+${dexMod}` : dexMod;
                                      })()}
                                    </p>
                                  </div>
                                  <div className="text-center p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                                    <p className="text-xs text-green-600 dark:text-green-400">Speed</p>
                                    <p className="font-bold text-xl text-green-700 dark:text-green-300">30ft</p>
                                  </div>
                                </div>
                              </div>

                              <div className="bg-white/50 dark:bg-slate-700/50 rounded-lg p-4">
                                <h4 className="font-fantasy text-sm font-bold text-amber-800 dark:text-amber-200 mb-3 flex items-center gap-2">
                                  <Sword className="h-4 w-4" />
                                  Attack Bonuses
                                </h4>
                                <div className="space-y-2 text-sm">
                                  <div className="flex justify-between items-center p-2 bg-amber-100/50 dark:bg-amber-900/30 rounded">
                                    <span>Melee Attack</span>
                                    <Badge variant="outline" className="bg-orange-100 dark:bg-orange-900/30">
                                      {(() => {
                                        const strMod = Math.floor(((character.strength || 10) - 10) / 2);
                                        const profBonus = Math.ceil((character.level || 1) / 4) + 1;
                                        const total = strMod + profBonus;
                                        return total >= 0 ? `+${total}` : total;
                                      })()}
                                    </Badge>
                                  </div>
                                  <div className="flex justify-between items-center p-2 bg-amber-100/50 dark:bg-amber-900/30 rounded">
                                    <span>Ranged Attack</span>
                                    <Badge variant="outline" className="bg-orange-100 dark:bg-orange-900/30">
                                      {(() => {
                                        const dexMod = Math.floor(((character.dexterity || 10) - 10) / 2);
                                        const profBonus = Math.ceil((character.level || 1) / 4) + 1;
                                        const total = dexMod + profBonus;
                                        return total >= 0 ? `+${total}` : total;
                                      })()}
                                    </Badge>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Right Column - Equipment & Background */}
                            <div className="space-y-4">
                              <div className="bg-white/50 dark:bg-slate-700/50 rounded-lg p-4">
                                <h4 className="font-fantasy text-sm font-bold text-amber-800 dark:text-amber-200 mb-3 flex items-center gap-2">
                                  <Package className="h-4 w-4" />
                                  Equipment
                                </h4>
                                {(() => {
                                  const equipmentList: string[] = Array.isArray(character.equipment) ? character.equipment as string[] : [];
                                  return equipmentList.length > 0 ? (
                                    <ul className="space-y-1 text-sm max-h-32 overflow-y-auto">
                                      {equipmentList.slice(0, 8).map((item: string, idx: number) => (
                                        <li key={idx} className="flex items-center gap-2 text-muted-foreground">
                                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                          {item}
                                        </li>
                                      ))}
                                      {equipmentList.length > 8 && (
                                        <li className="text-xs text-muted-foreground italic">
                                          +{equipmentList.length - 8} more items
                                        </li>
                                      )}
                                    </ul>
                                  ) : (
                                    <p className="text-sm text-muted-foreground italic">No equipment</p>
                                  );
                                })()}
                              </div>

                              <div className="bg-white/50 dark:bg-slate-700/50 rounded-lg p-4">
                                <h4 className="font-fantasy text-sm font-bold text-amber-800 dark:text-amber-200 mb-3 flex items-center gap-2">
                                  <Scroll className="h-4 w-4" />
                                  Background
                                </h4>
                                {character.background ? (
                                  <p className="text-sm text-muted-foreground line-clamp-4">
                                    {character.background}
                                  </p>
                                ) : (
                                  <p className="text-sm text-muted-foreground italic">No background story</p>
                                )}
                              </div>

                              <div className="flex justify-center gap-2">
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-700"
                                  onClick={() => setSelectedCharacter(character)}
                                >
                                  <Edit className="h-4 w-4 mr-2" />
                                  Edit Character
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button 
                                      variant="outline" 
                                      size="sm" 
                                      className="text-red-600 dark:text-red-400 border-red-300 dark:border-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Delete
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Delete {character.name}?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        This will permanently delete this character and all their progress.
                                        {character.status === "dead" && (
                                          <span className="block mt-2 text-orange-600 dark:text-orange-400">
                                            This character has died in battle. Deleting them will remove them from the game entirely.
                                          </span>
                                        )}
                                        This action cannot be undone.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => deleteCharacter.mutate(character.id)}
                                        className="bg-red-600 hover:bg-red-700 disabled:opacity-50"
                                        disabled={deleteCharacter.isPending}
                                      >
                                        {deleteCharacter.isPending ? "Deleting..." : "Delete Character"}
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
              
              {selectedCharacter && (
                <div className="mt-6">
                  <h2 className="text-2xl font-fantasy font-bold mb-4">Edit Character</h2>
                  <CharacterSheet character={selectedCharacter} />
                  <div className="mt-4 text-center">
                    <Button variant="outline" onClick={() => setSelectedCharacter(null)}>
                      Close Editor
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12 bg-muted/30 rounded-xl border border-dashed border-border">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <User className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-fantasy font-bold mb-2">No Characters Yet</h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Create your first hero to begin adventuring. Choose from ready-made templates or build a custom character.
              </p>
              <div className="flex gap-3 justify-center">
                <Button 
                  onClick={() => {
                    const quickTab = document.querySelector('[value="quick"]') as HTMLElement;
                    quickTab?.click();
                  }}
                  className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  Quick Create
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => {
                    const createTab = document.querySelector('[value="create"]') as HTMLElement;
                    createTab?.click();
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Advanced
                </Button>
              </div>
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="quick">
          {/* Build Guidance - Collapsible */}
          <Card className={`mb-6 border-2 transition-all ${showBuildGuidance ? 'border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-orange-500/5' : 'border-dashed border-muted-foreground/30'}`}>
            <button 
              className="w-full p-4 flex items-center justify-between text-left"
              onClick={() => setShowBuildGuidance(!showBuildGuidance)}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <HelpCircle className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Need help choosing?</h3>
                  <p className="text-xs text-muted-foreground">Learn about character builds and playstyles</p>
                </div>
              </div>
              {showBuildGuidance ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
            </button>
            
            {showBuildGuidance && (
              <CardContent className="pt-0 pb-6">
                <Separator className="mb-4" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {buildArchetypes.map((archetype) => {
                    const Icon = archetype.icon;
                    const isSelected = selectedArchetype === archetype.id;
                    return (
                      <button
                        key={archetype.id}
                        onClick={() => setSelectedArchetype(isSelected ? null : archetype.id)}
                        className={`p-4 rounded-lg border text-left transition-all ${
                          isSelected 
                            ? 'border-amber-500 bg-amber-500/10 shadow-md' 
                            : 'border-border hover:border-amber-500/50 hover:bg-muted/30'
                        }`}
                      >
                        <div className="flex items-center gap-3 mb-2">
                          <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${archetype.color} flex items-center justify-center`}>
                            <Icon className="h-5 w-5 text-white" />
                          </div>
                          <div>
                            <h4 className="font-semibold text-sm">{archetype.name}</h4>
                            <p className="text-xs text-muted-foreground">{archetype.summary}</p>
                          </div>
                        </div>
                        
                        {isSelected && (
                          <div className="mt-3 pt-3 border-t border-amber-500/20 space-y-2 text-sm">
                            <div>
                              <span className="font-medium text-amber-700 dark:text-amber-300">Best Classes: </span>
                              <span className="text-muted-foreground">{archetype.classes.join(', ')}</span>
                            </div>
                            <div>
                              <span className="font-medium text-amber-700 dark:text-amber-300">Key Stats: </span>
                              <span className="text-muted-foreground">{archetype.keyStats}</span>
                            </div>
                            <div>
                              <span className="font-medium text-amber-700 dark:text-amber-300">Playstyle: </span>
                              <span className="text-muted-foreground">{archetype.playstyle}</span>
                            </div>
                            <div className="bg-amber-500/10 rounded p-2 mt-2">
                              <span className="font-medium text-amber-700 dark:text-amber-300">Tip: </span>
                              <span className="text-muted-foreground text-xs">{archetype.tip}</span>
                            </div>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            )}
          </Card>

          <Card className="mb-6">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl font-fantasy bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
                Choose Your Hero
              </CardTitle>
              <p className="text-muted-foreground mt-2">
                Select a pre-built character to get started quickly
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {characterTemplates.map((template) => {
                  const Icon = template.icon;
                  const isSelected = selectedTemplate === template.id;
                  return (
                    <button
                      key={template.id}
                      onClick={() => setSelectedTemplate(template.id)}
                      className={`p-5 rounded-xl border-2 text-left transition-all hover:scale-105 ${
                        isSelected 
                          ? "border-primary bg-primary/10 shadow-lg ring-2 ring-primary/50" 
                          : "border-border hover:border-primary/50 hover:bg-muted/50"
                      }`}
                    >
                      <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${template.color} flex items-center justify-center mb-3 shadow-lg`}>
                        <Icon className="h-6 w-6 text-white" />
                      </div>
                      <h4 className="font-bold text-base">{template.name}</h4>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {template.description}
                      </p>
                      <div className="flex gap-2 mt-3">
                        <Badge variant="secondary" className="text-xs">
                          {template.race}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {template.class}
                        </Badge>
                      </div>
                    </button>
                  );
                })}
              </div>
              
              <div className="flex justify-center mt-8">
                <Button 
                  size="lg"
                  onClick={() => selectedTemplate && createFromTemplate(selectedTemplate)}
                  disabled={!selectedTemplate || isCreatingFromTemplate}
                  className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 px-8 py-6 text-lg shadow-lg"
                >
                  {isCreatingFromTemplate ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Creating Hero...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-5 w-5" />
                      Create This Hero
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="create">
          {/* Build Guidance for Advanced Tab */}
          <Card className={`mb-6 border-2 transition-all ${showBuildGuidance ? 'border-purple-500/30 bg-gradient-to-br from-purple-500/5 to-indigo-500/5' : 'border-dashed border-muted-foreground/30'}`}>
            <button 
              className="w-full p-4 flex items-center justify-between text-left"
              onClick={() => setShowBuildGuidance(!showBuildGuidance)}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/10">
                  <BookOpen className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Character Build Guide</h3>
                  <p className="text-xs text-muted-foreground">Learn about archetypes, stats, and playstyles before you build</p>
                </div>
              </div>
              {showBuildGuidance ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
            </button>
            
            {showBuildGuidance && (
              <CardContent className="pt-0 pb-6">
                <Separator className="mb-4" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
                  {buildArchetypes.map((archetype) => {
                    const Icon = archetype.icon;
                    const isSelected = selectedArchetype === archetype.id;
                    return (
                      <button
                        key={archetype.id}
                        onClick={() => setSelectedArchetype(isSelected ? null : archetype.id)}
                        className={`p-4 rounded-lg border text-left transition-all ${
                          isSelected 
                            ? 'border-purple-500 bg-purple-500/10 shadow-md' 
                            : 'border-border hover:border-purple-500/50 hover:bg-muted/30'
                        }`}
                      >
                        <div className="flex items-center gap-3 mb-2">
                          <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${archetype.color} flex items-center justify-center`}>
                            <Icon className="h-5 w-5 text-white" />
                          </div>
                          <div>
                            <h4 className="font-semibold text-sm">{archetype.name}</h4>
                            <p className="text-xs text-muted-foreground">{archetype.summary}</p>
                          </div>
                        </div>
                        
                        {isSelected && (
                          <div className="mt-3 pt-3 border-t border-purple-500/20 space-y-2 text-sm">
                            <div>
                              <span className="font-medium text-purple-700 dark:text-purple-300">Best Classes: </span>
                              <span className="text-muted-foreground">{archetype.classes.join(', ')}</span>
                            </div>
                            <div>
                              <span className="font-medium text-purple-700 dark:text-purple-300">Key Stats: </span>
                              <span className="text-muted-foreground">{archetype.keyStats}</span>
                            </div>
                            <div>
                              <span className="font-medium text-purple-700 dark:text-purple-300">Playstyle: </span>
                              <span className="text-muted-foreground">{archetype.playstyle}</span>
                            </div>
                            <div className="bg-purple-500/10 rounded p-2 mt-2">
                              <span className="font-medium text-purple-700 dark:text-purple-300">Tip: </span>
                              <span className="text-muted-foreground text-xs">{archetype.tip}</span>
                            </div>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
                
                {/* Quick stat allocation guide */}
                <div className="bg-muted/50 rounded-lg p-4">
                  <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                    <Dice6 className="h-4 w-4 text-purple-500" />
                    Stat Priority Guide
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                    <div className="p-2 bg-background rounded">
                      <span className="font-medium">Melee Combat:</span>
                      <span className="text-muted-foreground"> STR &gt; CON &gt; DEX</span>
                    </div>
                    <div className="p-2 bg-background rounded">
                      <span className="font-medium">Ranged/Finesse:</span>
                      <span className="text-muted-foreground"> DEX &gt; CON &gt; WIS</span>
                    </div>
                    <div className="p-2 bg-background rounded">
                      <span className="font-medium">Spellcasting:</span>
                      <span className="text-muted-foreground"> INT/WIS/CHA &gt; CON</span>
                    </div>
                    <div className="p-2 bg-background rounded">
                      <span className="font-medium">Support/Healing:</span>
                      <span className="text-muted-foreground"> WIS &gt; CON &gt; DEX</span>
                    </div>
                    <div className="p-2 bg-background rounded">
                      <span className="font-medium">Face/Social:</span>
                      <span className="text-muted-foreground"> CHA &gt; WIS &gt; INT</span>
                    </div>
                    <div className="p-2 bg-background rounded">
                      <span className="font-medium">Tank:</span>
                      <span className="text-muted-foreground"> CON &gt; STR &gt; WIS</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="font-fantasy">Create New Character</CardTitle>
                  <Button 
                    variant="outline" 
                    className="text-primary-light border-primary-light"
                    onClick={handleGenerateCharacter}
                    disabled={isGenerating}
                  >
                    {isGenerating ? "Generating..." : "AI Generate"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit((data) => createCharacter.mutate(data))} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Character Name</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter name" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="level"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Level</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                min={1} 
                                max={20} 
                                {...field} 
                                onChange={e => field.onChange(parseInt(e.target.value))}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="race"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Race</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select race" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {races.map(race => (
                                  <HoverCard key={race} openDelay={200} closeDelay={100}>
                                    <HoverCardTrigger asChild>
                                      <SelectItem value={race} className="cursor-pointer">
                                        <span className="flex items-center gap-2">
                                          {race}
                                          <Eye className="h-3 w-3 text-muted-foreground opacity-50" />
                                        </span>
                                      </SelectItem>
                                    </HoverCardTrigger>
                                    <HoverCardContent side="right" align="start" className="w-72 z-[100]">
                                      <div className="space-y-2">
                                        <h4 className="font-bold text-sm">{race}</h4>
                                        <div className="text-xs space-y-1">
                                          <div>
                                            <span className="font-medium text-amber-600 dark:text-amber-400">Traits: </span>
                                            <span className="text-muted-foreground">{raceInfo[race]?.traits}</span>
                                          </div>
                                          <div>
                                            <span className="font-medium text-green-600 dark:text-green-400">Advantages: </span>
                                            <span className="text-muted-foreground">{raceInfo[race]?.advantages}</span>
                                          </div>
                                          <div className="pt-1 border-t">
                                            <span className="font-medium text-blue-600 dark:text-blue-400">Best For: </span>
                                            <span className="text-muted-foreground">{raceInfo[race]?.bestFor}</span>
                                          </div>
                                        </div>
                                      </div>
                                    </HoverCardContent>
                                  </HoverCard>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="class"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Class</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select class" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {classes.map(cls => (
                                  <HoverCard key={cls} openDelay={200} closeDelay={100}>
                                    <HoverCardTrigger asChild>
                                      <SelectItem value={cls} className="cursor-pointer">
                                        <span className="flex items-center gap-2">
                                          {cls}
                                          <Eye className="h-3 w-3 text-muted-foreground opacity-50" />
                                        </span>
                                      </SelectItem>
                                    </HoverCardTrigger>
                                    <HoverCardContent side="right" align="start" className="w-80 z-[100]">
                                      <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                          <h4 className="font-bold text-sm">{cls}</h4>
                                          <Badge variant="secondary" className="text-xs">{classInfo[cls]?.hitDie}</Badge>
                                        </div>
                                        <p className="text-xs text-purple-600 dark:text-purple-400 font-medium">{classInfo[cls]?.role}</p>
                                        <div className="text-xs space-y-1">
                                          <div>
                                            <span className="font-medium text-amber-600 dark:text-amber-400">Primary Stat: </span>
                                            <span className="text-muted-foreground">{classInfo[cls]?.primaryStat}</span>
                                          </div>
                                          <div>
                                            <span className="font-medium text-green-600 dark:text-green-400">Key Features: </span>
                                            <span className="text-muted-foreground">{classInfo[cls]?.features}</span>
                                          </div>
                                          <div className="pt-1 border-t">
                                            <span className="font-medium text-blue-600 dark:text-blue-400">Playstyle: </span>
                                            <span className="text-muted-foreground">{classInfo[cls]?.playstyle}</span>
                                          </div>
                                        </div>
                                      </div>
                                    </HoverCardContent>
                                  </HoverCard>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="background"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Background</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value ?? undefined}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select background" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {backgrounds.map(bg => (
                                  <SelectItem key={bg} value={bg}>{bg}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="alignment"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Alignment</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value ?? undefined}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select alignment" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {alignments.map(alignment => (
                                  <HoverCard key={alignment} openDelay={200} closeDelay={100}>
                                    <HoverCardTrigger asChild>
                                      <SelectItem value={alignment} className="cursor-pointer">
                                        <span className="flex items-center gap-2">
                                          {alignment}
                                          <Eye className="h-3 w-3 text-muted-foreground opacity-50" />
                                        </span>
                                      </SelectItem>
                                    </HoverCardTrigger>
                                    <HoverCardContent side="right" align="start" className="w-72 z-[100]">
                                      <div className="space-y-2">
                                        <h4 className="font-bold text-sm">{alignment}</h4>
                                        <p className="text-xs text-muted-foreground">{alignmentInfo[alignment]?.description}</p>
                                        <div className="text-xs space-y-1">
                                          <div>
                                            <span className="font-medium text-purple-600 dark:text-purple-400">Examples: </span>
                                            <span className="text-muted-foreground">{alignmentInfo[alignment]?.examples}</span>
                                          </div>
                                          <div className="pt-1 border-t bg-muted/50 rounded p-2 mt-2">
                                            <span className="font-medium text-amber-600 dark:text-amber-400">Roleplay Tip: </span>
                                            <span className="text-muted-foreground italic">{alignmentInfo[alignment]?.roleplayTip}</span>
                                          </div>
                                        </div>
                                      </div>
                                    </HoverCardContent>
                                  </HoverCard>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <Separator />
                    
                    <div className="flex items-center justify-between">
                      <h3 className="font-fantasy text-lg font-bold">Ability Scores</h3>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const scores = rollAbilityScores();
                          form.setValue("strength", scores.strength);
                          form.setValue("dexterity", scores.dexterity);
                          form.setValue("constitution", scores.constitution);
                          form.setValue("intelligence", scores.intelligence);
                          form.setValue("wisdom", scores.wisdom);
                          form.setValue("charisma", scores.charisma);
                          // Update HP based on constitution modifier
                          const conMod = Math.floor((scores.constitution - 10) / 2);
                          const newHP = 10 + conMod;
                          form.setValue("hitPoints", newHP);
                          form.setValue("maxHitPoints", newHP);
                          // Update AC based on dexterity modifier
                          const dexMod = Math.floor((scores.dexterity - 10) / 2);
                          form.setValue("armorClass", 10 + dexMod);
                        }}
                        className="flex items-center gap-2"
                      >
                        <Dice6 className="h-4 w-4" />
                        Roll Stats (4d6 drop lowest)
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      Click "Roll Stats" to generate ability scores using D&D's 4d6 drop lowest method, or enter values manually.
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="strength"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Strength</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                min={3} 
                                max={20} 
                                {...field} 
                                onChange={e => field.onChange(parseInt(e.target.value))}
                              />
                            </FormControl>
                            <FormDescription className="text-xs">
                              Modifier: {Math.floor((field.value - 10) / 2)}
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="dexterity"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Dexterity</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                min={3} 
                                max={20} 
                                {...field} 
                                onChange={e => field.onChange(parseInt(e.target.value))}
                              />
                            </FormControl>
                            <FormDescription className="text-xs">
                              Modifier: {Math.floor((field.value - 10) / 2)}
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="constitution"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Constitution</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                min={3} 
                                max={20} 
                                {...field} 
                                onChange={e => field.onChange(parseInt(e.target.value))}
                              />
                            </FormControl>
                            <FormDescription className="text-xs">
                              Modifier: {Math.floor((field.value - 10) / 2)}
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="intelligence"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Intelligence</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                min={3} 
                                max={20} 
                                {...field} 
                                onChange={e => field.onChange(parseInt(e.target.value))}
                              />
                            </FormControl>
                            <FormDescription className="text-xs">
                              Modifier: {Math.floor((field.value - 10) / 2)}
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="wisdom"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Wisdom</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                min={3} 
                                max={20} 
                                {...field} 
                                onChange={e => field.onChange(parseInt(e.target.value))}
                              />
                            </FormControl>
                            <FormDescription className="text-xs">
                              Modifier: {Math.floor((field.value - 10) / 2)}
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="charisma"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Charisma</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                min={3} 
                                max={20} 
                                {...field} 
                                onChange={e => field.onChange(parseInt(e.target.value))}
                              />
                            </FormControl>
                            <FormDescription className="text-xs">
                              Modifier: {Math.floor((field.value - 10) / 2)}
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <Separator />
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="hitPoints"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Hit Points</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                min={1} 
                                {...field} 
                                onChange={e => field.onChange(parseInt(e.target.value))}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="maxHitPoints"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Max Hit Points</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                min={1} 
                                {...field} 
                                onChange={e => field.onChange(parseInt(e.target.value))}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="armorClass"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Armor Class</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                min={1} 
                                {...field} 
                                onChange={e => field.onChange(parseInt(e.target.value))}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <Button 
                      type="submit" 
                      className="w-full bg-primary-light hover:bg-primary-dark"
                      disabled={createCharacter.isPending}
                    >
                      {createCharacter.isPending ? "Creating..." : "Create Character"}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
            
            <div>
              <Card>
                <CardHeader>
                  <CardTitle className="font-fantasy">Character Preview</CardTitle>
                </CardHeader>
                <CardContent className="p-4 character-sheet">
                  <div className="mb-4 text-secondary border-b-2 border-primary pb-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-fantasy text-xl font-bold text-primary">
                        {form.watch("name") || "New Character"}
                      </h3>
                      <span className="bg-primary text-white text-sm px-3 py-1 rounded-full">
                        Level {form.watch("level")}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <p className="text-sm text-gray-600">Race</p>
                        <p className="font-medium text-secondary">{form.watch("race") || "Not selected"}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Class</p>
                        <p className="font-medium text-secondary">{form.watch("class") || "Not selected"}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Background</p>
                        <p className="font-medium text-secondary">{form.watch("background") || "Not selected"}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Alignment</p>
                        <p className="font-medium text-secondary">{form.watch("alignment") || "Not selected"}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mb-6 text-secondary">
                    <h3 className="font-fantasy text-lg font-bold mb-3 text-primary-light">Abilities</h3>
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      <div className="bg-parchment-dark rounded-lg p-3 text-center relative">
                        <p className="text-xs text-gray-600">STR</p>
                        <p className="font-bold text-xl text-secondary">{form.watch("strength")}</p>
                        <p className="text-secondary text-sm">
                          ({Math.floor((form.watch("strength") - 10) / 2) >= 0 ? "+" : ""}
                          {Math.floor((form.watch("strength") - 10) / 2)})
                        </p>
                      </div>
                      
                      <div className="bg-parchment-dark rounded-lg p-3 text-center relative">
                        <p className="text-xs text-gray-600">DEX</p>
                        <p className="font-bold text-xl text-secondary">{form.watch("dexterity")}</p>
                        <p className="text-secondary text-sm">
                          ({Math.floor((form.watch("dexterity") - 10) / 2) >= 0 ? "+" : ""}
                          {Math.floor((form.watch("dexterity") - 10) / 2)})
                        </p>
                      </div>
                      
                      <div className="bg-parchment-dark rounded-lg p-3 text-center">
                        <p className="text-xs text-gray-600">CON</p>
                        <p className="font-bold text-xl text-secondary">{form.watch("constitution")}</p>
                        <p className="text-secondary text-sm">
                          ({Math.floor((form.watch("constitution") - 10) / 2) >= 0 ? "+" : ""}
                          {Math.floor((form.watch("constitution") - 10) / 2)})
                        </p>
                      </div>
                      
                      <div className="bg-parchment-dark rounded-lg p-3 text-center">
                        <p className="text-xs text-gray-600">INT</p>
                        <p className="font-bold text-xl text-secondary">{form.watch("intelligence")}</p>
                        <p className="text-secondary text-sm">
                          ({Math.floor((form.watch("intelligence") - 10) / 2) >= 0 ? "+" : ""}
                          {Math.floor((form.watch("intelligence") - 10) / 2)})
                        </p>
                      </div>
                      
                      <div className="bg-parchment-dark rounded-lg p-3 text-center">
                        <p className="text-xs text-gray-600">WIS</p>
                        <p className="font-bold text-xl text-secondary">{form.watch("wisdom")}</p>
                        <p className="text-secondary text-sm">
                          ({Math.floor((form.watch("wisdom") - 10) / 2) >= 0 ? "+" : ""}
                          {Math.floor((form.watch("wisdom") - 10) / 2)})
                        </p>
                      </div>
                      
                      <div className="bg-parchment-dark rounded-lg p-3 text-center">
                        <p className="text-xs text-gray-600">CHA</p>
                        <p className="font-bold text-xl text-secondary">{form.watch("charisma")}</p>
                        <p className="text-secondary text-sm">
                          ({Math.floor((form.watch("charisma") - 10) / 2) >= 0 ? "+" : ""}
                          {Math.floor((form.watch("charisma") - 10) / 2)})
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mb-6 text-secondary">
                    <h3 className="font-fantasy text-lg font-bold mb-3 text-primary-light">Combat</h3>
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      <div className="bg-parchment-dark rounded-lg p-3 text-center border border-primary">
                        <p className="text-xs text-gray-600">Hit Points</p>
                        <p className="font-bold text-xl text-secondary">
                          {form.watch("hitPoints")}/{form.watch("maxHitPoints")}
                        </p>
                      </div>
                      
                      <div className="bg-parchment-dark rounded-lg p-3 text-center">
                        <p className="text-xs text-gray-600">Armor Class</p>
                        <p className="font-bold text-xl text-secondary">{form.watch("armorClass")}</p>
                      </div>
                      
                      <div className="bg-parchment-dark rounded-lg p-3 text-center">
                        <p className="text-xs text-gray-600">Initiative</p>
                        <p className="font-bold text-xl text-secondary">
                          {Math.floor((form.watch("dexterity") - 10) / 2) >= 0 ? "+" : ""}
                          {Math.floor((form.watch("dexterity") - 10) / 2)}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
      </div>
    </div>
  );
}
