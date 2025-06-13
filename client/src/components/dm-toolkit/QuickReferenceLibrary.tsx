import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { 
  Search, 
  Book, 
  Zap, 
  Sword, 
  Users, 
  Shield,
  Star,
  Clock,
  Target,
  Eye,
  Flame,
  Snowflake,
  Wind,
  Droplets
} from "lucide-react";

interface Spell {
  name: string;
  level: number;
  school: string;
  castingTime: string;
  range: string;
  components: string[];
  duration: string;
  description: string;
  classes: string[];
  concentration: boolean;
  ritual: boolean;
}

interface Monster {
  name: string;
  size: string;
  type: string;
  cr: string;
  ac: number;
  hp: number;
  speed: string;
  abilities: {
    str: number;
    dex: number;
    con: number;
    int: number;
    wis: number;
    cha: number;
  };
  skills?: string[];
  senses?: string;
  languages?: string;
  actions: { name: string; description: string }[];
}

interface Rule {
  category: string;
  title: string;
  description: string;
  page?: number;
}

interface Condition {
  name: string;
  description: string;
  effects: string[];
}

export default function QuickReferenceLibrary() {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("spells");
  const [selectedItem, setSelectedItem] = useState<any>(null);

  // Common spells database
  const spells: Spell[] = [
    {
      name: "Fireball",
      level: 3,
      school: "Evocation",
      castingTime: "1 action",
      range: "150 feet",
      components: ["V", "S", "M"],
      duration: "Instantaneous",
      description: "A bright streak flashes from your pointing finger to a point you choose within range and then blossoms with a low roar into an explosion of flame. Each creature in a 20-foot-radius sphere centered on that point must make a Dexterity saving throw. A target takes 8d6 fire damage on a failed save, or half as much damage on a successful one.",
      classes: ["Sorcerer", "Wizard"],
      concentration: false,
      ritual: false
    },
    {
      name: "Healing Word",
      level: 1,
      school: "Evocation",
      castingTime: "1 bonus action",
      range: "60 feet",
      components: ["V"],
      duration: "Instantaneous",
      description: "A creature of your choice that you can see within range regains hit points equal to 1d4 + your spellcasting ability modifier. This spell has no effect on undead or constructs.",
      classes: ["Bard", "Cleric", "Druid"],
      concentration: false,
      ritual: false
    },
    {
      name: "Shield",
      level: 1,
      school: "Abjuration",
      castingTime: "1 reaction",
      range: "Self",
      components: ["V", "S"],
      duration: "1 round",
      description: "An invisible barrier of magical force appears and protects you. Until the start of your next turn, you have a +5 bonus to AC, including against the triggering attack, and you take no damage from magic missile.",
      classes: ["Sorcerer", "Wizard"],
      concentration: false,
      ritual: false
    }
  ];

  // Common monsters database
  const monsters: Monster[] = [
    {
      name: "Goblin",
      size: "Small",
      type: "humanoid",
      cr: "1/4",
      ac: 15,
      hp: 7,
      speed: "30 ft.",
      abilities: { str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8 },
      skills: ["Stealth +6"],
      senses: "darkvision 60 ft., passive Perception 9",
      languages: "Common, Goblin",
      actions: [
        { name: "Scimitar", description: "Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 5 (1d6 + 2) slashing damage." },
        { name: "Shortbow", description: "Ranged Weapon Attack: +4 to hit, range 80/320 ft., one target. Hit: 5 (1d6 + 2) piercing damage." }
      ]
    },
    {
      name: "Orc",
      size: "Medium",
      type: "humanoid",
      cr: "1/2",
      ac: 13,
      hp: 15,
      speed: "30 ft.",
      abilities: { str: 16, dex: 12, con: 16, int: 7, wis: 11, cha: 10 },
      skills: ["Intimidation +2"],
      senses: "darkvision 60 ft., passive Perception 10",
      languages: "Common, Orc",
      actions: [
        { name: "Greataxe", description: "Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 9 (1d12 + 3) slashing damage." },
        { name: "Javelin", description: "Melee or Ranged Weapon Attack: +5 to hit, reach 5 ft. or range 30/120 ft., one target. Hit: 6 (1d6 + 3) piercing damage." }
      ]
    }
  ];

  // Rules reference
  const rules: Rule[] = [
    {
      category: "Combat",
      title: "Attack Rolls",
      description: "To make an attack roll, roll a d20 and add the appropriate ability modifier. If the total equals or exceeds the target's AC, the attack hits."
    },
    {
      category: "Combat",
      title: "Advantage and Disadvantage",
      description: "When you have advantage, roll two d20s and use the higher roll. When you have disadvantage, roll two d20s and use the lower roll."
    },
    {
      category: "Combat",
      title: "Critical Hits",
      description: "When you roll a 20 on an attack roll, you score a critical hit. Roll all damage dice twice and add them together, then add any relevant modifiers."
    },
    {
      category: "Spellcasting",
      title: "Concentration",
      description: "Some spells require concentration. If you lose concentration, the spell ends. You lose concentration if you cast another concentration spell, take damage, or fail a Constitution saving throw."
    }
  ];

  // Conditions reference
  const conditions: Condition[] = [
    {
      name: "Blinded",
      description: "A blinded creature can't see and automatically fails any ability check that requires sight.",
      effects: [
        "Attack rolls against the creature have advantage",
        "The creature's attack rolls have disadvantage"
      ]
    },
    {
      name: "Charmed",
      description: "A charmed creature can't attack the charmer or target the charmer with harmful abilities or magical effects.",
      effects: [
        "The charmer has advantage on any ability check to interact socially with the creature"
      ]
    },
    {
      name: "Frightened",
      description: "A frightened creature has disadvantage on ability checks and attack rolls while the source of its fear is within line of sight.",
      effects: [
        "The creature can't willingly move closer to the source of its fear"
      ]
    },
    {
      name: "Paralyzed",
      description: "A paralyzed creature is incapacitated and can't move or speak.",
      effects: [
        "The creature automatically fails Strength and Dexterity saving throws",
        "Attack rolls against the creature have advantage",
        "Any attack that hits the creature is a critical hit if the attacker is within 5 feet"
      ]
    }
  ];

  const filteredSpells = spells.filter(spell =>
    spell.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    spell.school.toLowerCase().includes(searchTerm.toLowerCase()) ||
    spell.classes.some(cls => cls.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredMonsters = monsters.filter(monster =>
    monster.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    monster.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
    monster.cr.includes(searchTerm)
  );

  const filteredRules = rules.filter(rule =>
    rule.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    rule.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    rule.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredConditions = conditions.filter(condition =>
    condition.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    condition.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getSchoolIcon = (school: string) => {
    const icons: { [key: string]: JSX.Element } = {
      'Evocation': <Flame className="h-3 w-3" />,
      'Abjuration': <Shield className="h-3 w-3" />,
      'Enchantment': <Star className="h-3 w-3" />,
      'Conjuration': <Wind className="h-3 w-3" />,
      'Transmutation': <Target className="h-3 w-3" />,
      'Divination': <Eye className="h-3 w-3" />,
      'Illusion': <Droplets className="h-3 w-3" />,
      'Necromancy': <Snowflake className="h-3 w-3" />
    };
    return icons[school] || <Zap className="h-3 w-3" />;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Quick Reference Library</h3>
        <Badge variant="secondary">
          <Book className="h-3 w-3 mr-1" />
          D&D 5e Reference
        </Badge>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search spells, monsters, rules, conditions..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="spells">
            <Zap className="h-4 w-4 mr-1" />
            Spells
          </TabsTrigger>
          <TabsTrigger value="monsters">
            <Users className="h-4 w-4 mr-1" />
            Monsters
          </TabsTrigger>
          <TabsTrigger value="rules">
            <Book className="h-4 w-4 mr-1" />
            Rules
          </TabsTrigger>
          <TabsTrigger value="conditions">
            <Shield className="h-4 w-4 mr-1" />
            Conditions
          </TabsTrigger>
        </TabsList>

        {/* Spells Tab */}
        <TabsContent value="spells" className="space-y-2">
          <ScrollArea className="h-96">
            {filteredSpells.map((spell, index) => (
              <Dialog key={index}>
                <DialogTrigger asChild>
                  <Card className="cursor-pointer hover:shadow-md transition-all mb-2">
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          {getSchoolIcon(spell.school)}
                          <div>
                            <h4 className="font-medium text-sm">{spell.name}</h4>
                            <p className="text-xs text-muted-foreground">
                              Level {spell.level} {spell.school}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-1">
                          {spell.concentration && (
                            <Badge variant="outline" className="text-xs">C</Badge>
                          )}
                          {spell.ritual && (
                            <Badge variant="outline" className="text-xs">R</Badge>
                          )}
                          <Badge variant="secondary" className="text-xs">
                            {spell.castingTime}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle className="flex items-center space-x-2">
                      {getSchoolIcon(spell.school)}
                      <span>{spell.name}</span>
                    </DialogTitle>
                    <DialogDescription>
                      Level {spell.level} {spell.school}
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium">Casting Time:</span> {spell.castingTime}
                      </div>
                      <div>
                        <span className="font-medium">Range:</span> {spell.range}
                      </div>
                      <div>
                        <span className="font-medium">Components:</span> {spell.components.join(", ")}
                      </div>
                      <div>
                        <span className="font-medium">Duration:</span> {spell.duration}
                      </div>
                    </div>
                    
                    <div>
                      <span className="font-medium text-sm">Classes:</span>
                      <div className="flex space-x-1 mt-1">
                        {spell.classes.map((cls, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {cls}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    
                    <div>
                      <span className="font-medium text-sm">Description:</span>
                      <p className="text-sm mt-1 leading-relaxed">{spell.description}</p>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            ))}
          </ScrollArea>
        </TabsContent>

        {/* Monsters Tab */}
        <TabsContent value="monsters" className="space-y-2">
          <ScrollArea className="h-96">
            {filteredMonsters.map((monster, index) => (
              <Dialog key={index}>
                <DialogTrigger asChild>
                  <Card className="cursor-pointer hover:shadow-md transition-all mb-2">
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium text-sm">{monster.name}</h4>
                          <p className="text-xs text-muted-foreground">
                            {monster.size} {monster.type} • CR {monster.cr}
                          </p>
                        </div>
                        <div className="text-right text-xs">
                          <div>AC {monster.ac}</div>
                          <div>{monster.hp} HP</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>{monster.name}</DialogTitle>
                    <DialogDescription>
                      {monster.size} {monster.type} • Challenge Rating {monster.cr}
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="font-medium">Armor Class:</span> {monster.ac}
                      </div>
                      <div>
                        <span className="font-medium">Hit Points:</span> {monster.hp}
                      </div>
                      <div>
                        <span className="font-medium">Speed:</span> {monster.speed}
                      </div>
                    </div>
                    
                    <div>
                      <span className="font-medium text-sm">Ability Scores:</span>
                      <div className="grid grid-cols-6 gap-2 mt-1 text-xs">
                        <div className="text-center">
                          <div className="font-medium">STR</div>
                          <div>{monster.abilities.str}</div>
                        </div>
                        <div className="text-center">
                          <div className="font-medium">DEX</div>
                          <div>{monster.abilities.dex}</div>
                        </div>
                        <div className="text-center">
                          <div className="font-medium">CON</div>
                          <div>{monster.abilities.con}</div>
                        </div>
                        <div className="text-center">
                          <div className="font-medium">INT</div>
                          <div>{monster.abilities.int}</div>
                        </div>
                        <div className="text-center">
                          <div className="font-medium">WIS</div>
                          <div>{monster.abilities.wis}</div>
                        </div>
                        <div className="text-center">
                          <div className="font-medium">CHA</div>
                          <div>{monster.abilities.cha}</div>
                        </div>
                      </div>
                    </div>
                    
                    {monster.skills && (
                      <div>
                        <span className="font-medium text-sm">Skills:</span>
                        <p className="text-sm">{monster.skills.join(", ")}</p>
                      </div>
                    )}
                    
                    {monster.senses && (
                      <div>
                        <span className="font-medium text-sm">Senses:</span>
                        <p className="text-sm">{monster.senses}</p>
                      </div>
                    )}
                    
                    {monster.languages && (
                      <div>
                        <span className="font-medium text-sm">Languages:</span>
                        <p className="text-sm">{monster.languages}</p>
                      </div>
                    )}
                    
                    <div>
                      <span className="font-medium text-sm">Actions:</span>
                      <div className="space-y-2 mt-1">
                        {monster.actions.map((action, i) => (
                          <div key={i} className="text-sm">
                            <span className="font-medium">{action.name}.</span> {action.description}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            ))}
          </ScrollArea>
        </TabsContent>

        {/* Rules Tab */}
        <TabsContent value="rules" className="space-y-2">
          <ScrollArea className="h-96">
            {filteredRules.map((rule, index) => (
              <Card key={index}>
                <CardContent className="p-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <Badge variant="outline" className="text-xs">
                          {rule.category}
                        </Badge>
                        <h4 className="font-medium text-sm">{rule.title}</h4>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {rule.description}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </ScrollArea>
        </TabsContent>

        {/* Conditions Tab */}
        <TabsContent value="conditions" className="space-y-2">
          <ScrollArea className="h-96">
            {filteredConditions.map((condition, index) => (
              <Card key={index}>
                <CardContent className="p-3">
                  <div>
                    <h4 className="font-medium text-sm mb-1">{condition.name}</h4>
                    <p className="text-sm text-muted-foreground mb-2">
                      {condition.description}
                    </p>
                    <div className="space-y-1">
                      {condition.effects.map((effect, i) => (
                        <div key={i} className="flex items-start space-x-2 text-xs">
                          <div className="w-1 h-1 rounded-full bg-primary mt-2 flex-shrink-0" />
                          <span>{effect}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}