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
import { AlertCircle, Plus, User, Dice6, Swords } from "lucide-react";

// Extended schema with validation rules
const createCharacterSchema = insertCharacterSchema.extend({
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
  
  const { toast } = useToast();
  
  const { data: characters, isLoading } = useQuery<Character[]>({
    queryKey: ['/api/characters'],
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(createCharacterSchema),
    defaultValues: {
      userId: 1, // Default to first user for demo
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
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-fantasy font-bold mb-6">Character Management</h1>
      
      <Tabs defaultValue="list">
        <TabsList className="mb-6">
          <TabsTrigger value="list" className="flex items-center gap-2">
            <User size={16} />
            My Characters
          </TabsTrigger>
          <TabsTrigger value="create" className="flex items-center gap-2">
            <Plus size={16} />
            Create New
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
            <div className="text-center py-12 bg-secondary-light rounded-lg">
              <AlertCircle className="h-12 w-12 text-primary-light mx-auto mb-4" />
              <h3 className="text-xl font-fantasy font-bold mb-2">No Characters Found</h3>
              <p className="text-muted-foreground mb-6">You haven't created any characters yet.</p>
              <Button onClick={() => document.querySelector('[value="create"]')?.dispatchEvent(new Event('click'))}>
                Create Your First Character
              </Button>
            </div>
          )}
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
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                    
                    <h3 className="font-fantasy text-lg font-bold">Ability Scores</h3>
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
  );
}
