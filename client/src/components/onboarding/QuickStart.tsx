import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  Sword, 
  Wand2, 
  Shield, 
  Heart, 
  Flame,
  Moon,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Check,
  Sparkles,
  Play
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { Character } from "@shared/schema";

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

const adventureThemes = [
  { id: "classic", name: "Classic Dungeon", description: "Explore ancient ruins and fight monsters", icon: "🏰" },
  { id: "mystery", name: "Mystery", description: "Solve puzzles and uncover secrets", icon: "🔮" },
  { id: "heroic", name: "Heroic Quest", description: "Save the realm from darkness", icon: "⚔️" },
  { id: "exploration", name: "Exploration", description: "Discover new lands and treasures", icon: "🗺️" },
];

interface QuickStartProps {
  onComplete?: () => void;
  existingCharacters?: Character[];
}

export default function QuickStart({ onComplete, existingCharacters = [] }: QuickStartProps) {
  const [step, setStep] = useState(existingCharacters.length > 0 ? 1 : 0);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [selectedCharacter, setSelectedCharacter] = useState<number | null>(
    existingCharacters.length > 0 ? existingCharacters[0].id : null
  );
  const [selectedTheme, setSelectedTheme] = useState<string>("classic");
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const createCharacterMutation = useMutation({
    mutationFn: async (template: typeof characterTemplates[0]) => {
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
      return response.json();
    },
    onSuccess: (character) => {
      queryClient.invalidateQueries({ queryKey: ["/api/characters"] });
      setSelectedCharacter(character.id);
      setStep(2);
      toast({
        title: "Hero Created!",
        description: `${character.name} is ready for adventure.`,
      });
    },
  });

  const createCampaignMutation = useMutation({
    mutationFn: async () => {
      const theme = adventureThemes.find(t => t.id === selectedTheme);
      const response = await apiRequest("POST", "/api/campaigns", {
        title: `${theme?.name || "Adventure"} Quest`,
        description: theme?.description || "A new adventure begins...",
        difficulty: "balanced",
        narrativeStyle: "descriptive",
        setting: theme?.id || "classic",
      });
      return response.json();
    },
    onSuccess: (campaign) => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      toast({
        title: "Adventure Created!",
        description: "Your quest awaits. Let the adventure begin!",
      });
      if (onComplete) {
        onComplete();
      }
      navigate("/dashboard");
    },
  });

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId);
  };

  const handleCreateCharacter = () => {
    const template = characterTemplates.find(t => t.id === selectedTemplate);
    if (template) {
      createCharacterMutation.mutate(template);
    }
  };

  const handleUseExisting = () => {
    if (existingCharacters.length > 0) {
      setSelectedCharacter(existingCharacters[0].id);
      setStep(2);
    }
  };

  const handleStartAdventure = () => {
    createCampaignMutation.mutate();
  };

  const steps = [
    { label: "Choose Hero", icon: Sword },
    { label: "Select Character", icon: Check },
    { label: "Pick Adventure", icon: Play },
  ];

  return (
    <Card className="w-full max-w-2xl mx-auto shadow-xl border-primary/20">
      <CardHeader className="text-center pb-2">
        <CardTitle className="text-2xl bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
          Quick Start
        </CardTitle>
        <CardDescription>Get playing in just a few steps</CardDescription>
        
        <div className="flex justify-center gap-2 mt-4">
          {steps.map((s, i) => (
            <div 
              key={i}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-all ${
                i === step 
                  ? "bg-primary text-primary-foreground" 
                  : i < step
                  ? "bg-green-500/20 text-green-500"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {i < step ? <Check className="h-3 w-3" /> : <s.icon className="h-3 w-3" />}
              <span className="hidden sm:inline">{s.label}</span>
              <span className="sm:hidden">{i + 1}</span>
            </div>
          ))}
        </div>
      </CardHeader>
      
      <CardContent className="p-6">
        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div
              key="step0"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <h3 className="font-semibold text-lg text-center mb-4">Choose Your Hero</h3>
              
              {existingCharacters.length > 0 && (
                <div className="mb-6 p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-2">You already have characters!</p>
                  <Button variant="outline" className="w-full" onClick={handleUseExisting}>
                    Use Existing Character
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              )}
              
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {characterTemplates.map((template) => {
                  const Icon = template.icon;
                  const isSelected = selectedTemplate === template.id;
                  return (
                    <button
                      key={template.id}
                      onClick={() => handleTemplateSelect(template.id)}
                      className={`p-4 rounded-lg border-2 text-left transition-all hover:scale-105 ${
                        isSelected 
                          ? "border-primary bg-primary/10 shadow-lg" 
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${template.color} flex items-center justify-center mb-2`}>
                        <Icon className="h-5 w-5 text-white" />
                      </div>
                      <h4 className="font-medium text-sm">{template.name}</h4>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {template.description}
                      </p>
                      <Badge variant="secondary" className="mt-2 text-xs">
                        {template.class}
                      </Badge>
                    </button>
                  );
                })}
              </div>
              
              <div className="flex justify-end mt-6">
                <Button 
                  onClick={handleCreateCharacter}
                  disabled={!selectedTemplate || createCharacterMutation.isPending}
                  className="bg-gradient-to-r from-amber-500 to-orange-500"
                >
                  {createCharacterMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      Create Hero
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
          )}
          
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <h3 className="font-semibold text-lg text-center mb-4">Select Your Character</h3>
              
              <div className="grid gap-3">
                {existingCharacters.map((char) => (
                  <button
                    key={char.id}
                    onClick={() => setSelectedCharacter(char.id)}
                    className={`p-4 rounded-lg border-2 text-left transition-all flex items-center gap-4 ${
                      selectedCharacter === char.id
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-xl font-bold">
                      {char.name.charAt(0)}
                    </div>
                    <div>
                      <h4 className="font-medium">{char.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        Level {char.level} {char.race} {char.class}
                      </p>
                    </div>
                    {selectedCharacter === char.id && (
                      <Check className="ml-auto h-5 w-5 text-primary" />
                    )}
                  </button>
                ))}
              </div>
              
              <div className="flex justify-between mt-6">
                <Button variant="outline" onClick={() => setStep(0)}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button 
                  onClick={() => setStep(2)}
                  disabled={!selectedCharacter}
                  className="bg-gradient-to-r from-amber-500 to-orange-500"
                >
                  Continue
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          )}
          
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <h3 className="font-semibold text-lg text-center mb-4">Choose Your Adventure</h3>
              
              <div className="grid grid-cols-2 gap-3">
                {adventureThemes.map((theme) => (
                  <button
                    key={theme.id}
                    onClick={() => setSelectedTheme(theme.id)}
                    className={`p-4 rounded-lg border-2 text-left transition-all ${
                      selectedTheme === theme.id
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <span className="text-3xl mb-2 block">{theme.icon}</span>
                    <h4 className="font-medium">{theme.name}</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      {theme.description}
                    </p>
                  </button>
                ))}
              </div>
              
              <div className="flex justify-between mt-6">
                <Button variant="outline" onClick={() => setStep(1)}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button 
                  onClick={handleStartAdventure}
                  disabled={createCampaignMutation.isPending}
                  className="bg-gradient-to-r from-amber-500 to-orange-500"
                >
                  {createCampaignMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Start Adventure
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
