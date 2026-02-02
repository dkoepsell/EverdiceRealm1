import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { 
  Sparkles, 
  Play, 
  ChevronLeft, 
  ChevronRight,
  X,
  Sword,
  Wand2,
  Shield,
  Moon,
  Dice5,
  MessageCircle,
  ArrowRight
} from "lucide-react";

interface CharacterTemplate {
  id: string;
  name: string;
  class: string;
  race: string;
  icon: any;
  color: string;
  description: string;
}

interface AdventureTheme {
  id: string;
  name: string;
  description: string;
  icon: any;
  color: string;
}

const CHARACTER_TEMPLATES: CharacterTemplate[] = [
  {
    id: "warrior",
    name: "Bold Warrior",
    class: "Fighter",
    race: "Human",
    icon: Sword,
    color: "from-red-500 to-orange-500",
    description: "Charge into battle with sword and shield"
  },
  {
    id: "wizard",
    name: "Clever Wizard",
    class: "Wizard",
    race: "Elf",
    icon: Wand2,
    color: "from-purple-500 to-indigo-500",
    description: "Solve problems with powerful magic"
  },
  {
    id: "paladin",
    name: "Noble Paladin",
    class: "Paladin",
    race: "Human",
    icon: Shield,
    color: "from-yellow-500 to-amber-500",
    description: "Defend the innocent with holy power"
  },
  {
    id: "rogue",
    name: "Cunning Rogue",
    class: "Rogue",
    race: "Halfling",
    icon: Moon,
    color: "from-slate-500 to-zinc-600",
    description: "Sneak, steal, and strike from shadows"
  }
];

const ADVENTURE_THEMES: AdventureTheme[] = [
  {
    id: "dungeon",
    name: "The Lost Dungeon",
    description: "Explore ancient ruins and find treasure",
    icon: Sword,
    color: "from-stone-500 to-slate-600"
  },
  {
    id: "mystery",
    name: "Village Mystery",
    description: "Solve a crime and uncover secrets",
    icon: MessageCircle,
    color: "from-emerald-500 to-teal-500"
  }
];

// Generate a simple story scene based on selections
function generateDemoStory(characterClass: string, theme: string): string[] {
  const stories: Record<string, Record<string, string[]>> = {
    dungeon: {
      Fighter: [
        "You stand at the entrance of an ancient stone dungeon. Torchlight flickers on the walls.",
        "Your sword gleams as you step forward. A strange sound echoes from deep within...",
        "You see a chest in the corner! But wait — something moves in the shadows.",
        "A goblin leaps out! You raise your sword. Roll for initiative!"
      ],
      Wizard: [
        "Arcane symbols glow on the dungeon walls as you enter. Your staff pulses with power.",
        "You sense magical traps ahead. Your knowledge of the arcane may be your greatest weapon.",
        "A locked door blocks your path. Strange runes cover its surface.",
        "You recognize the spell! With a wave of your hand, the door opens..."
      ],
      Paladin: [
        "Light radiates from your holy symbol as you enter the darkness.",
        "You feel the presence of evil ahead. Your oath compels you forward.",
        "A wounded traveler lies ahead. Do you stop to help, or press on?",
        "Your healing touch restores them. They whisper of dangers ahead..."
      ],
      Rogue: [
        "You slip into the dungeon unseen, keeping to the shadows.",
        "Your trained eyes spot a hidden tripwire. An amateur trap.",
        "You hear guards ahead. Two of them, arguing about something.",
        "You could sneak past... or take them out quietly. Your choice."
      ]
    },
    mystery: {
      Fighter: [
        "The village elder asks for your help. Someone has been stealing from the market.",
        "Your intimidating presence makes the merchants talk. One mentions a suspicious stranger.",
        "You find the stranger at the tavern. They look nervous when they see you.",
        "They try to run! Do you chase them or block the door?"
      ],
      Wizard: [
        "Strange magic has been affecting the village. Crops wither, animals act oddly.",
        "You detect traces of dark magic leading to an abandoned mill.",
        "Inside, you find ritual markings on the floor. This is no amateur work.",
        "A figure in a dark cloak appears behind you. 'You shouldn't have come here...'"
      ],
      Paladin: [
        "A sacred relic has been stolen from the village temple. The priest is distraught.",
        "Your divine sense guides you. The thief headed toward the forest.",
        "You find a camp. A young person holds the relic, crying.",
        "They stole it to save their sick mother. Justice... or mercy?"
      ],
      Rogue: [
        "The guild master has a job: find out who's been counterfeiting coins.",
        "You blend into the market crowd, watching for anything suspicious.",
        "A merchant's coin purse seems heavier than it should be.",
        "Following them leads to a secret basement. You hear a printing press..."
      ]
    }
  };
  
  return stories[theme]?.[characterClass] || stories.dungeon.Fighter;
}

export default function GuestQuickPlay({ 
  onComplete, 
  onCancel 
}: { 
  onComplete: () => void;
  onCancel: () => void;
}) {
  const [step, setStep] = useState(0);
  const [selectedCharacter, setSelectedCharacter] = useState<string | null>(null);
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);
  const [storyIndex, setStoryIndex] = useState(0);
  const [diceResult, setDiceResult] = useState<number | null>(null);
  const [isRolling, setIsRolling] = useState(false);

  const selectedCharTemplate = CHARACTER_TEMPLATES.find(c => c.id === selectedCharacter);
  const selectedThemeTemplate = ADVENTURE_THEMES.find(t => t.id === selectedTheme);
  
  const story = selectedCharTemplate && selectedThemeTemplate 
    ? generateDemoStory(selectedCharTemplate.class, selectedThemeTemplate.id)
    : [];

  const handleRollDice = () => {
    setIsRolling(true);
    // Animate dice roll
    let rolls = 0;
    const interval = setInterval(() => {
      setDiceResult(Math.floor(Math.random() * 20) + 1);
      rolls++;
      if (rolls > 10) {
        clearInterval(interval);
        setIsRolling(false);
        const finalRoll = Math.floor(Math.random() * 20) + 1;
        setDiceResult(finalRoll);
      }
    }, 100);
  };

  const handleNext = () => {
    if (step === 0 && selectedCharacter) {
      setStep(1);
    } else if (step === 1 && selectedTheme) {
      setStep(2);
      setStoryIndex(0);
    } else if (step === 2) {
      if (storyIndex < story.length - 1) {
        setStoryIndex(storyIndex + 1);
        setDiceResult(null);
      } else {
        setStep(3); // Completion step
      }
    }
  };

  const progress = step === 0 ? 25 : step === 1 ? 50 : step === 2 ? 75 : 100;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl bg-gradient-to-b from-slate-900 to-slate-950 border-slate-700 text-white overflow-hidden">
        <div className="p-4 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-400" />
            <span className="font-bold text-amber-400">Try D&D — Quick Demo</span>
          </div>
          <Button variant="ghost" size="icon" onClick={onCancel} className="text-slate-400 hover:text-white">
            <X className="h-5 w-5" />
          </Button>
        </div>
        
        <Progress value={progress} className="h-1" />
        
        <CardContent className="p-6">
          {/* Step 0: Choose Character */}
          {step === 0 && (
            <div className="space-y-4">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold mb-2">Who Do You Want to Be?</h2>
                <p className="text-slate-400">Pick a hero for your quick adventure</p>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                {CHARACTER_TEMPLATES.map((char) => {
                  const Icon = char.icon;
                  return (
                    <button
                      key={char.id}
                      onClick={() => setSelectedCharacter(char.id)}
                      className={`p-4 rounded-lg border-2 text-left transition-all ${
                        selectedCharacter === char.id
                          ? 'border-amber-500 bg-amber-500/10'
                          : 'border-slate-700 hover:border-slate-500 bg-slate-800/50'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${char.color} flex items-center justify-center mb-2`}>
                        <Icon className="h-5 w-5 text-white" />
                      </div>
                      <h3 className="font-bold">{char.name}</h3>
                      <p className="text-xs text-slate-400">{char.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 1: Choose Adventure */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold mb-2">What Story Awaits?</h2>
                <p className="text-slate-400">Pick your adventure type</p>
              </div>
              
              <div className="grid grid-cols-1 gap-3">
                {ADVENTURE_THEMES.map((theme) => {
                  const Icon = theme.icon;
                  return (
                    <button
                      key={theme.id}
                      onClick={() => setSelectedTheme(theme.id)}
                      className={`p-5 rounded-lg border-2 text-left transition-all ${
                        selectedTheme === theme.id
                          ? 'border-amber-500 bg-amber-500/10'
                          : 'border-slate-700 hover:border-slate-500 bg-slate-800/50'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${theme.color} flex items-center justify-center`}>
                          <Icon className="h-6 w-6 text-white" />
                        </div>
                        <div>
                          <h3 className="font-bold text-lg">{theme.name}</h3>
                          <p className="text-sm text-slate-400">{theme.description}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 2: Story */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between text-sm text-slate-400 mb-4">
                <span>Scene {storyIndex + 1} of {story.length}</span>
                <span className="flex items-center gap-1">
                  Playing as: <span className="text-amber-400 font-medium">{selectedCharTemplate?.name}</span>
                </span>
              </div>
              
              <div className="bg-slate-800 rounded-lg p-6 min-h-[120px]">
                <p className="text-lg leading-relaxed">{story[storyIndex]}</p>
              </div>
              
              {/* Dice roll for last scene */}
              {storyIndex === story.length - 1 && (
                <div className="text-center space-y-4">
                  <p className="text-amber-400 font-medium">Roll the dice to see what happens!</p>
                  
                  <Button
                    onClick={handleRollDice}
                    disabled={isRolling}
                    className="bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 px-8 py-6 text-lg"
                  >
                    <Dice5 className={`mr-2 h-6 w-6 ${isRolling ? 'animate-spin' : ''}`} />
                    {isRolling ? 'Rolling...' : 'Roll d20'}
                  </Button>
                  
                  {diceResult && !isRolling && (
                    <div className="mt-4">
                      <div className={`inline-flex items-center justify-center w-20 h-20 rounded-xl text-3xl font-bold ${
                        diceResult >= 17 ? 'bg-emerald-500 text-white' : 
                        diceResult <= 5 ? 'bg-red-500 text-white' : 
                        'bg-slate-700 text-white'
                      }`}>
                        {diceResult}
                      </div>
                      <p className="mt-2 text-sm">
                        {diceResult >= 17 ? '🎉 Critical success! Amazing!' : 
                         diceResult >= 10 ? '✓ Success! Well done.' : 
                         diceResult >= 6 ? '⚠️ Close call...' :
                         '💀 Uh oh... things get interesting!'}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Completion */}
          {step === 3 && (
            <div className="text-center space-y-6 py-4">
              <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                <Sparkles className="h-10 w-10 text-white" />
              </div>
              
              <div>
                <h2 className="text-2xl font-bold mb-2">That's D&D!</h2>
                <p className="text-slate-400">
                  You just played a mini adventure. The real thing has more story, 
                  more choices, and your character grows over time.
                </p>
              </div>
              
              <div className="bg-slate-800 rounded-lg p-4">
                <h3 className="font-bold mb-2 text-amber-400">What's next?</h3>
                <ul className="text-sm text-slate-300 space-y-1 text-left">
                  <li>• Create a free account to save your progress</li>
                  <li>• Build a character with real D&D stats</li>
                  <li>• Play full campaigns with AI storytelling</li>
                  <li>• Invite friends to join your adventures</li>
                </ul>
              </div>
              
              <Button
                onClick={onComplete}
                className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 px-8 py-6 text-lg w-full"
              >
                Visit the Hearth — Meet the Community
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          )}
        </CardContent>
        
        {/* Navigation */}
        {step < 3 && (
          <div className="p-4 border-t border-slate-700 flex justify-between">
            <Button
              variant="ghost"
              onClick={() => step > 0 ? setStep(step - 1) : onCancel()}
              className="text-slate-400"
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              {step === 0 ? 'Cancel' : 'Back'}
            </Button>
            
            <Button
              onClick={handleNext}
              disabled={(step === 0 && !selectedCharacter) || (step === 1 && !selectedTheme) || (step === 2 && storyIndex === story.length - 1 && !diceResult)}
              className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
            >
              {step === 2 ? (storyIndex < story.length - 1 ? 'Continue' : 'Finish') : 'Next'}
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
