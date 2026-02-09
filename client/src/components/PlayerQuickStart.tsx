import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  Sparkles, 
  Play, 
  ChevronLeft, 
  ChevronRight,
  Loader2,
  Sword,
  Wand2,
  Shield,
  Heart,
  Flame,
  Moon,
  Users,
  Map,
  Castle,
  Skull,
  TreePine,
  Check
} from "lucide-react";

interface CharacterTemplate {
  id: string;
  name: string;
  class: string;
  race: string;
  icon: any;
  color: string;
  description: string;
  playstyle: string;
}

interface CompanionTemplate {
  id: string;
  name: string;
  role: string;
  description: string;
  icon: any;
  color: string;
  abilities: string[];
}

interface AdventureTheme {
  id: string;
  name: string;
  description: string;
  icon: any;
  color: string;
  difficulty: string;
}

const CHARACTER_TEMPLATES: CharacterTemplate[] = [
  {
    id: "warrior",
    name: "Bold Warrior",
    class: "Fighter",
    race: "Human",
    icon: Sword,
    color: "from-red-500 to-orange-500",
    description: "Charge into battle with sword and shield",
    playstyle: "Direct combat, protecting allies"
  },
  {
    id: "wizard",
    name: "Clever Wizard",
    class: "Wizard",
    race: "Elf",
    icon: Wand2,
    color: "from-purple-500 to-indigo-500",
    description: "Solve problems with powerful magic",
    playstyle: "Spellcasting, knowledge, puzzles"
  },
  {
    id: "paladin",
    name: "Noble Paladin",
    class: "Paladin",
    race: "Human",
    icon: Shield,
    color: "from-yellow-500 to-amber-500",
    description: "Defend the innocent with holy power",
    playstyle: "Combat and healing, moral choices"
  },
  {
    id: "rogue",
    name: "Cunning Rogue",
    class: "Rogue",
    race: "Halfling",
    icon: Moon,
    color: "from-slate-500 to-zinc-600",
    description: "Sneak, steal, and strike from shadows",
    playstyle: "Stealth, traps, surprise attacks"
  }
];

const COMPANION_TEMPLATES: CompanionTemplate[] = [
  {
    id: "mentor",
    name: "Elara the Sage",
    role: "Mentor & Guide",
    description: "A wise mage who teaches as you adventure together",
    icon: Wand2,
    color: "from-blue-500 to-cyan-500",
    abilities: ["Gives helpful tips", "Explains the world", "Knows history"]
  },
  {
    id: "protector",
    name: "Grimjaw the Bold",
    role: "Battle Companion",
    description: "A veteran warrior who has your back in combat",
    icon: Shield,
    color: "from-amber-500 to-orange-500",
    abilities: ["Fights alongside you", "Shares combat tactics", "Loyal protector"]
  },
  {
    id: "healer",
    name: "Sister Maeve",
    role: "Healer & Support",
    description: "A kind cleric who keeps you alive and offers guidance",
    icon: Heart,
    color: "from-pink-500 to-rose-500",
    abilities: ["Heals your wounds", "Offers moral advice", "Blesses your actions"]
  }
];

const ADVENTURE_THEMES: AdventureTheme[] = [
  {
    id: "dungeon",
    name: "The Lost Dungeon",
    description: "Explore ancient ruins, find treasure, battle monsters",
    icon: Castle,
    color: "from-stone-500 to-slate-600",
    difficulty: "Beginner-friendly"
  },
  {
    id: "mystery",
    name: "Village Mystery",
    description: "Solve a crime, interview suspects, uncover secrets",
    icon: Map,
    color: "from-emerald-500 to-teal-500",
    difficulty: "Story-focused"
  },
  {
    id: "wilderness",
    name: "Wilderness Journey",
    description: "Travel through dangerous wilds, survive and explore",
    icon: TreePine,
    color: "from-green-500 to-lime-500",
    difficulty: "Exploration-focused"
  },
  {
    id: "monster",
    name: "Monster Hunt",
    description: "Track and defeat a dangerous creature threatening the land",
    icon: Skull,
    color: "from-red-600 to-rose-600",
    difficulty: "Combat-focused"
  }
];

const STEP_TITLES = [
  "Choose Your Hero",
  "Pick a Companion",
  "Select Your Adventure",
  "Ready to Go!"
];

// Fantasy name parts for generating unique character names
const FIRST_NAME_PARTS = {
  Fighter: ["Gar", "Thor", "Bran", "Kord", "Vorn", "Rok", "Drak", "Mal", "Grim", "Tor"],
  Wizard: ["Thal", "Eld", "Myr", "Zeph", "Cal", "Nar", "Ven", "Sar", "Lyr", "Gor"],
  Paladin: ["Val", "Sir", "Aur", "Rad", "Sol", "Lux", "Gal", "Cer", "Dom", "Jor"],
  Rogue: ["Sly", "Nim", "Shade", "Vex", "Fox", "Dash", "Flick", "Jinx", "Trick", "Sneak"]
};

const LAST_NAME_PARTS = {
  Fighter: ["axe", "hammer", "iron", "steel", "stone", "fist", "blade", "shield"],
  Wizard: ["wind", "star", "moon", "fire", "frost", "storm", "spark", "shadow"],
  Paladin: ["light", "heart", "soul", "dawn", "glory", "valor", "hope", "grace"],
  Rogue: ["foot", "hand", "eye", "blade", "shadow", "whisper", "step", "knife"]
};

function generateFantasyName(characterClass: string, existingNames: string[] = []): string {
  const firstParts = FIRST_NAME_PARTS[characterClass as keyof typeof FIRST_NAME_PARTS] || FIRST_NAME_PARTS.Fighter;
  const lastParts = LAST_NAME_PARTS[characterClass as keyof typeof LAST_NAME_PARTS] || LAST_NAME_PARTS.Fighter;
  const existingSet = new Set(existingNames.map(n => n.toLowerCase()));
  
  for (let attempt = 0; attempt < 50; attempt++) {
    const firstName = firstParts[Math.floor(Math.random() * firstParts.length)];
    const lastName = lastParts[Math.floor(Math.random() * lastParts.length)];
    const capitalizedLast = lastName.charAt(0).toUpperCase() + lastName.slice(1);
    const name = `${firstName}${capitalizedLast}`;
    
    if (!existingSet.has(name.toLowerCase())) {
      return name;
    }
  }
  
  const firstName = firstParts[Math.floor(Math.random() * firstParts.length)];
  const lastName = lastParts[Math.floor(Math.random() * lastParts.length)];
  const capitalizedLast = lastName.charAt(0).toUpperCase() + lastName.slice(1);
  const suffix = Math.floor(Math.random() * 900) + 100;
  return `${firstName}${capitalizedLast}${suffix}`;
}

const STEP_DESCRIPTIONS = [
  "Who do you want to be? Pick a hero that sounds fun!",
  "You won't be alone! Choose a friend to adventure with.",
  "What kind of story do you want to experience?",
  "Your party is assembled and your adventure awaits!"
];

export default function PlayerQuickStart({ 
  onComplete, 
  onCancel 
}: { 
  onComplete: (campaignId: number, characterId: number) => void;
  onCancel: () => void;
}) {
  const { toast } = useToast();
  const { data: existingCharacters = [] } = useQuery<any[]>({
    queryKey: ["/api/characters"],
  });
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedCharacter, setSelectedCharacter] = useState<string | null>(null);
  const [selectedCompanion, setSelectedCompanion] = useState<string | null>(null);
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);
  const [createdResult, setCreatedResult] = useState<{ campaignId: number; characterId: number; companionName: string; companionRole: string } | null>(null);

  const createAdventureMutation = useMutation({
    mutationFn: async () => {
      const charTemplate = CHARACTER_TEMPLATES.find(c => c.id === selectedCharacter);
      const companionTemplate = COMPANION_TEMPLATES.find(c => c.id === selectedCompanion);
      const themeTemplate = ADVENTURE_THEMES.find(t => t.id === selectedTheme);
      
      if (!charTemplate || !companionTemplate || !themeTemplate) {
        throw new Error("Please complete all selections");
      }

      const stats = {
        strength: charTemplate.class === "Fighter" ? 16 : charTemplate.class === "Paladin" ? 15 : charTemplate.class === "Rogue" ? 10 : charTemplate.class === "Wizard" ? 8 : 12,
        dexterity: charTemplate.class === "Rogue" ? 16 : charTemplate.class === "Wizard" ? 12 : 12,
        constitution: 14,
        intelligence: charTemplate.class === "Wizard" ? 16 : 10,
        wisdom: 12,
        charisma: charTemplate.class === "Paladin" ? 14 : 10
      };
      const hp = charTemplate.class === "Fighter" || charTemplate.class === "Paladin" ? 12 : 8;
      const ac = charTemplate.class === "Fighter" || charTemplate.class === "Paladin" ? 16 : 12;
      
      const characterData = {
        name: generateFantasyName(charTemplate.class, existingCharacters.map((c: any) => c.name)),
        race: charTemplate.race,
        class: charTemplate.class,
        level: 1,
        background: "Adventurer",
        alignment: "Neutral Good",
        strength: stats.strength,
        dexterity: stats.dexterity,
        constitution: stats.constitution,
        intelligence: stats.intelligence,
        wisdom: stats.wisdom,
        charisma: stats.charisma,
        hitPoints: hp,
        maxHitPoints: hp,
        armorClass: ac,
        skills: [],
        equipment: [],
        createdAt: new Date().toISOString()
      };

      const charResponse = await apiRequest("POST", "/api/characters", characterData);
      const character = await charResponse.json();

      const campaignData = {
        title: `${themeTemplate.name}: A Solo Adventure`,
        description: `A beginner-friendly ${themeTemplate.description.toLowerCase()}. You'll learn as you play with ${companionTemplate.name} as your guide and companion.`,
        difficulty: "balanced",
        narrativeStyle: "tutorial_friendly",
        campaignLength: "oneshot"
      };

      const campaignResponse = await apiRequest("POST", "/api/campaigns", campaignData);
      const campaign = await campaignResponse.json();

      const companionNpcData = {
        name: companionTemplate.name,
        race: "Human",
        occupation: companionTemplate.role,
        personality: companionTemplate.description,
        appearance: "Friendly and approachable, with a warm demeanor",
        motivation: "Help the hero learn and grow on their journey",
        hitPoints: 25,
        maxHitPoints: 25,
        armorClass: 14,
        level: 3,
        isCompanion: true,
        companionType: companionTemplate.id === "protector" ? "combat" : companionTemplate.id === "healer" ? "healer" : "social"
      };

      const npcResponse = await apiRequest("POST", "/api/npcs", companionNpcData);
      const companion = await npcResponse.json();

      await apiRequest("POST", `/api/campaigns/${campaign.id}/npcs`, {
        npcId: companion.id,
        role: "companion"
      });

      await apiRequest("POST", `/api/campaigns/${campaign.id}/participants`, {
        characterId: character.id,
        role: "player"
      });

      queryClient.invalidateQueries({ queryKey: ['/api/campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['/api/characters'] });

      const companionName = companionTemplate.name;
      const companionRole = companionTemplate.role;
      return { campaignId: campaign.id, characterId: character.id, companionName, companionRole };
    },
    onSuccess: (result) => {
      setCreatedResult(result);
      setCurrentStep(3);
    },
    onError: (error: any) => {
      toast({
        title: "Something went wrong",
        description: error.message || "Please try again",
        variant: "destructive"
      });
    }
  });

  const canProceed = () => {
    if (currentStep === 0) return !!selectedCharacter;
    if (currentStep === 1) return !!selectedCompanion;
    if (currentStep === 2) return !!selectedTheme;
    return false;
  };

  const handleNext = () => {
    if (currentStep < 2) {
      setCurrentStep(currentStep + 1);
    } else {
      createAdventureMutation.mutate();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const progress = ((currentStep + 1) / 4) * 100;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30 mb-4">
          <Sparkles className="h-4 w-4 text-green-500" />
          <span className="text-sm font-medium text-green-400">Learn by Playing</span>
        </div>
        <h2 className="text-2xl font-bold mb-2">{STEP_TITLES[currentStep]}</h2>
        <p className="text-muted-foreground">{STEP_DESCRIPTIONS[currentStep]}</p>
      </div>

      <Progress value={progress} className="mb-6 h-2" />

      <div className="mb-6">
        {currentStep === 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {CHARACTER_TEMPLATES.map((char) => {
              const Icon = char.icon;
              const isSelected = selectedCharacter === char.id;
              return (
                <Card 
                  key={char.id}
                  className={`cursor-pointer transition-all hover:scale-105 ${
                    isSelected 
                      ? 'ring-2 ring-primary shadow-lg' 
                      : 'hover:shadow-md'
                  }`}
                  onClick={() => setSelectedCharacter(char.id)}
                >
                  <CardContent className="p-4 text-center">
                    <div className={`w-16 h-16 mx-auto rounded-full bg-gradient-to-br ${char.color} flex items-center justify-center mb-3`}>
                      <Icon className="h-8 w-8 text-white" />
                    </div>
                    <h3 className="font-semibold mb-1">{char.name}</h3>
                    <p className="text-xs text-muted-foreground mb-2">{char.description}</p>
                    <Badge variant="secondary" className="text-xs">
                      {char.playstyle}
                    </Badge>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {currentStep === 1 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {COMPANION_TEMPLATES.map((comp) => {
              const Icon = comp.icon;
              const isSelected = selectedCompanion === comp.id;
              return (
                <Card 
                  key={comp.id}
                  className={`cursor-pointer transition-all hover:scale-105 ${
                    isSelected 
                      ? 'ring-2 ring-primary shadow-lg' 
                      : 'hover:shadow-md'
                  }`}
                  onClick={() => setSelectedCompanion(comp.id)}
                >
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      <div className={`w-14 h-14 rounded-full bg-gradient-to-br ${comp.color} flex items-center justify-center flex-shrink-0`}>
                        <Icon className="h-7 w-7 text-white" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold mb-0.5">{comp.name}</h3>
                        <p className="text-sm text-primary mb-2">{comp.role}</p>
                        <p className="text-xs text-muted-foreground mb-3">{comp.description}</p>
                        <div className="flex flex-wrap gap-1">
                          {comp.abilities.map((ability, i) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {ability}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {currentStep === 2 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {ADVENTURE_THEMES.map((theme) => {
              const Icon = theme.icon;
              const isSelected = selectedTheme === theme.id;
              return (
                <Card 
                  key={theme.id}
                  className={`cursor-pointer transition-all hover:scale-105 ${
                    isSelected 
                      ? 'ring-2 ring-primary shadow-lg' 
                      : 'hover:shadow-md'
                  }`}
                  onClick={() => setSelectedTheme(theme.id)}
                >
                  <CardContent className="p-4 text-center">
                    <div className={`w-16 h-16 mx-auto rounded-full bg-gradient-to-br ${theme.color} flex items-center justify-center mb-3`}>
                      <Icon className="h-8 w-8 text-white" />
                    </div>
                    <h3 className="font-semibold mb-1">{theme.name}</h3>
                    <p className="text-xs text-muted-foreground mb-2">{theme.description}</p>
                    <Badge variant="secondary" className="text-xs">
                      {theme.difficulty}
                    </Badge>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {currentStep === 3 && createdResult && (
          <div className="text-center space-y-6">
            <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
              <Check className="h-10 w-10 text-white" />
            </div>
            
            <div>
              <h3 className="text-xl font-bold mb-2">Your Party is Ready!</h3>
              <p className="text-muted-foreground">
                You've got a hero and a companion by your side. Time to adventure!
              </p>
            </div>

            <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/30 text-left">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center flex-shrink-0">
                  <Users className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h4 className="font-semibold text-blue-300">{createdResult.companionName}</h4>
                  <p className="text-sm text-blue-400/80">{createdResult.companionRole}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Your companion will fight alongside you, offer guidance, and help you learn the 
                    ropes as you play. They're part of your party from the start!
                  </p>
                </div>
              </div>
            </div>

            <Button 
              onClick={() => {
                toast({
                  title: "Adventure awaits!",
                  description: `${createdResult.companionName} is ready to join you. Let the adventure begin!`,
                });
                onComplete(createdResult.campaignId, createdResult.characterId);
              }}
              className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 py-6 text-lg"
            >
              <Play className="mr-2 h-5 w-5" />
              Begin Your Adventure!
            </Button>
          </div>
        )}
      </div>

      {currentStep < 3 && (
        <div className="flex justify-between items-center pt-4 border-t">
          <Button
            variant="ghost"
            onClick={currentStep === 0 ? onCancel : handleBack}
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            {currentStep === 0 ? "Cancel" : "Back"}
          </Button>

          <div className="flex items-center gap-2">
            {[0, 1, 2, 3].map((step) => (
              <div 
                key={step}
                className={`w-2 h-2 rounded-full transition-colors ${
                  step <= currentStep ? 'bg-primary' : 'bg-muted'
                }`}
              />
            ))}
          </div>

          <Button
            onClick={handleNext}
            disabled={!canProceed() || createAdventureMutation.isPending}
            className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
          >
            {createAdventureMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : currentStep === 2 ? (
              <>
                <Play className="h-4 w-4 mr-2" />
                Start Adventure!
              </>
            ) : (
              <>
                Next
                <ChevronRight className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
