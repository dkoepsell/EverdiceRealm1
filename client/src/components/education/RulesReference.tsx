import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Search, Dice6, Shield, Sword, Heart, Eye, MessageCircle, Zap } from "lucide-react";

interface RuleItem {
  name: string;
  description: string;
  mechanics: string;
  examples?: string[];
  category: string;
  icon?: any;
}

const SKILLS: RuleItem[] = [
  {
    name: "Perception",
    description: "Your general awareness of your surroundings and the keenness of your senses.",
    mechanics: "Wisdom (Perception) check. Passive Perception = 10 + Wisdom modifier + proficiency (if proficient).",
    examples: [
      "Spotting a hidden door or secret compartment",
      "Hearing approaching enemies through a door",
      "Noticing someone following you in a crowd",
      "Detecting a trap before triggering it"
    ],
    category: "skills",
    icon: Eye
  },
  {
    name: "Persuasion",
    description: "When you attempt to influence someone through tact, social graces, or good nature.",
    mechanics: "Charisma (Persuasion) check. Often contested against target's Insight or set DC.",
    examples: [
      "Convincing a guard to let you pass",
      "Negotiating better prices with merchants",
      "Rallying allies before a difficult battle",
      "Talking your way out of trouble"
    ],
    category: "skills",
    icon: MessageCircle
  },
  {
    name: "Investigation",
    description: "Looking around for clues and making deductions based on those clues.",
    mechanics: "Intelligence (Investigation) check. Different from Perception - this is active searching and reasoning.",
    examples: [
      "Searching a room for hidden compartments",
      "Deducing what happened at a crime scene",
      "Finding the weak point in a wall",
      "Researching information in a library"
    ],
    category: "skills",
    icon: Search
  }
];

const CONDITIONS: RuleItem[] = [
  {
    name: "Poisoned",
    description: "A poisoned creature has disadvantage on attack rolls and ability checks.",
    mechanics: "Disadvantage on all attack rolls and ability checks until the condition ends.",
    examples: [
      "Drinking contaminated water",
      "Being bitten by a venomous snake",
      "Inhaling toxic gas"
    ],
    category: "conditions",
    icon: Heart
  },
  {
    name: "Charmed",
    description: "A charmed creature can't attack the charmer or target the charmer with harmful abilities or magical effects.",
    mechanics: "Cannot attack or harm the charmer. The charmer has advantage on social interaction checks.",
    examples: [
      "Enchanted by a vampire's charm",
      "Under the effect of a Charm Person spell",
      "Influenced by a succubus"
    ],
    category: "conditions",
    icon: Heart
  }
];

const COMBAT_ACTIONS: RuleItem[] = [
  {
    name: "Attack",
    description: "Make one melee or ranged attack.",
    mechanics: "Roll d20 + ability modifier + proficiency bonus vs target's AC. On hit, roll weapon damage.",
    examples: [
      "Swing a sword at an enemy",
      "Fire an arrow from a bow",
      "Cast a spell that requires an attack roll"
    ],
    category: "combat",
    icon: Sword
  },
  {
    name: "Dodge",
    description: "Focus entirely on avoiding attacks.",
    mechanics: "Until start of next turn, attack rolls against you have disadvantage, and you make Dexterity saves with advantage.",
    examples: [
      "Avoiding dragon breath while allies attack",
      "Dancing around multiple enemies",
      "Buying time while retreating"
    ],
    category: "combat",
    icon: Shield
  },
  {
    name: "Help",
    description: "Aid a friendly creature in completing a task.",
    mechanics: "Give advantage on next ability check or attack roll, or perform other helpful actions.",
    examples: [
      "Distracting an enemy so ally can attack",
      "Helping stabilize a dying companion",
      "Assisting with a difficult skill check"
    ],
    category: "combat",
    icon: Heart
  }
];

export function RulesReference() {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("skills");

  const allRules = [...SKILLS, ...CONDITIONS, ...COMBAT_ACTIONS];
  const filteredRules = allRules.filter(rule => 
    rule.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    rule.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getRulesForCategory = (category: string) => {
    return filteredRules.filter(rule => rule.category === category);
  };

  const RuleCard = ({ rule }: { rule: RuleItem }) => {
    const IconComponent = rule.icon;
    return (
      <Card className="mb-4">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            {IconComponent && <IconComponent className="h-5 w-5 text-primary" />}
            <CardTitle className="text-lg">{rule.name}</CardTitle>
            <Badge variant="outline" className="ml-auto text-xs">
              {rule.category}
            </Badge>
          </div>
          <CardDescription>{rule.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <h4 className="font-semibold text-sm mb-1 text-primary">Game Mechanics:</h4>
            <p className="text-sm bg-muted p-2 rounded">{rule.mechanics}</p>
          </div>
          {rule.examples && (
            <div>
              <h4 className="font-semibold text-sm mb-2 text-primary">Common Examples:</h4>
              <ul className="text-sm space-y-1">
                {rule.examples.map((example, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="text-muted-foreground">•</span>
                    <span>{example}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="mb-6">
        <h1 className="text-3xl font-bold font-fantasy text-primary mb-2">D&D Rules Reference</h1>
        <p className="text-muted-foreground">
          Quick reference for D&D 5e mechanics, skills, and combat actions. Learn the rules as you play!
        </p>
      </div>

      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search rules, skills, conditions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="skills" className="flex items-center gap-2">
            <Dice6 className="h-4 w-4" />
            Skills
          </TabsTrigger>
          <TabsTrigger value="conditions" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Conditions
          </TabsTrigger>
          <TabsTrigger value="combat" className="flex items-center gap-2">
            <Sword className="h-4 w-4" />
            Combat
          </TabsTrigger>
        </TabsList>

        <div className="mt-6">
          <TabsContent value="skills">
            <ScrollArea className="h-[600px]">
              <div className="space-y-4">
                {getRulesForCategory("skills").map((rule, index) => (
                  <RuleCard key={index} rule={rule} />
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="conditions">
            <ScrollArea className="h-[600px]">
              <div className="space-y-4">
                {getRulesForCategory("conditions").map((rule, index) => (
                  <RuleCard key={index} rule={rule} />
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="combat">
            <ScrollArea className="h-[600px]">
              <div className="space-y-4">
                {getRulesForCategory("combat").map((rule, index) => (
                  <RuleCard key={index} rule={rule} />
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
        </div>
      </Tabs>

      <Card className="mt-6 bg-primary/5 border-primary/20">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Dice6 className="h-5 w-5" />
            Quick Tips for New Players
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p><strong>When in doubt, ask!</strong> Your DM is there to help explain rules and situations.</p>
          <p><strong>Describe your intent:</strong> Instead of just saying "I attack," describe what you're trying to achieve.</p>
          <p><strong>Use your skills:</strong> Remember you have proficiencies - use them to solve problems creatively!</p>
          <p><strong>Teamwork matters:</strong> The Help action can give allies advantage on their rolls.</p>
        </CardContent>
      </Card>
    </div>
  );
}