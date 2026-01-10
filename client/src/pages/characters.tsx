import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Character, insertCharacterSchema } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { generateCharacterSuggestion } from "@/lib/openai";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { AlertCircle, Plus, User, Users, Dice6, Swords, Sparkles, Sword, Wand2, Shield, Heart, Flame, Moon, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

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
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [isCreatingFromTemplate, setIsCreatingFromTemplate] = useState(false);
  
  const { toast } = useToast();
  
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
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-8 md:py-12 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-transparent"></div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl"></div>
        <div className="absolute top-6 right-8 md:right-16 opacity-15">
          <User className="h-14 w-14 md:h-20 md:w-20 text-amber-400" />
        </div>
        <div className="absolute top-16 right-20 md:right-40 opacity-10">
          <Swords className="h-10 w-10 md:h-16 md:w-16 text-orange-300 rotate-12" />
        </div>
        <div className="container mx-auto px-4 relative z-10">
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
      
      <div className="container mx-auto px-4 py-8">
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
            <div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                {characters.map((character) => (
                  <Card 
                    key={character.id} 
                    className="cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => setSelectedCharacter(character)}
                  >
                    <CardHeader className="bg-primary text-white pb-2">
                      <div className="flex justify-between items-center">
                        <CardTitle className="font-fantasy">{character.name}</CardTitle>
                        <span className="bg-primary-light text-white text-sm px-3 py-1 rounded-full">
                          Level {character.level}
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-4 character-sheet">
                      <div className="grid grid-cols-2 gap-2 text-secondary mb-4">
                        <div>
                          <p className="text-sm text-gray-600">Race</p>
                          <p className="font-medium">{character.race}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Class</p>
                          <p className="font-medium">{character.class}</p>
                        </div>
                      </div>
                      
                      <div className="flex justify-between mt-4 gap-2">
                        <div className="flex items-center bg-destructive/10 px-2 py-1 rounded border border-destructive/20">
                          <Swords size={16} className="text-destructive mr-1" />
                          <span className="text-sm font-bold text-foreground">HP: {character.hitPoints}/{character.maxHitPoints}</span>
                        </div>
                        <div className="flex items-center bg-primary/10 px-2 py-1 rounded border border-primary/20">
                          <Dice6 size={16} className="text-primary mr-1" />
                          <span className="text-sm font-bold text-foreground">AC: {character.armorClass}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              
              {selectedCharacter && (
                <div className="mt-6">
                  <h2 className="text-2xl font-fantasy font-bold mb-4">Character Details</h2>
                  <CharacterSheet character={selectedCharacter} />
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
                                  <SelectItem key={race} value={race}>{race}</SelectItem>
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
                                  <SelectItem key={cls} value={cls}>{cls}</SelectItem>
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
                                  <SelectItem key={alignment} value={alignment}>{alignment}</SelectItem>
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
