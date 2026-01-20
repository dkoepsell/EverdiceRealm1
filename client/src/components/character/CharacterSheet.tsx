import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Character, PlayerGroupMember } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, Image, BookOpen, Shield, Users, Crown, Sparkles } from "lucide-react";
import CharacterPortraitGenerator from "./CharacterPortraitGenerator";
import CharacterStoryArc from "./CharacterStoryArc";
import SpellBook from "@/components/SpellBook";
import { getQueryFn } from "@/lib/queryClient";

const SPELLCASTING_CLASSES = [
  'wizard', 'sorcerer', 'cleric', 'bard', 'druid', 'warlock', 'paladin', 'ranger'
];

interface EnrichedMembership extends PlayerGroupMember {
  groupName?: string;
  groupType?: string;
  groupMotto?: string;
}

const roleIcons: Record<string, any> = {
  founder: Crown,
  leader: Shield,
  member: Users,
};

const roleColors: Record<string, string> = {
  founder: "text-amber-400",
  leader: "text-purple-400",
  member: "text-blue-400",
};

interface CharacterSheetProps {
  character: Character;
}

export default function CharacterSheet({ character }: CharacterSheetProps) {
  const [activeTab, setActiveTab] = useState("main");
  const [isExpanded, setIsExpanded] = useState(true);

  const { data: memberships = [] } = useQuery<EnrichedMembership[]>({
    queryKey: ['/api/user/memberships'],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  // Calculate ability modifiers
  const getModifier = (abilityScore: number) => {
    return Math.floor((abilityScore - 10) / 2);
  };

  // Format modifiers to include the sign
  const formatModifier = (modifier: number) => {
    return modifier >= 0 ? `+${modifier}` : `${modifier}`;
  };
  
  // Toggle character sheet expanded/collapsed state
  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <Card className="bg-secondary-light rounded-lg shadow-xl overflow-hidden">
      <div className="bg-primary p-4 flex justify-between items-center">
        <h2 className="font-fantasy text-xl font-bold text-white">Character Sheet</h2>
        <Button 
          variant="ghost" 
          size="sm" 
          className="text-white hover:bg-primary-dark"
          onClick={toggleExpanded}
          aria-label={isExpanded ? "Collapse character sheet" : "Expand character sheet"}
        >
          {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
        </Button>
      </div>
      
      {isExpanded ? (
        <div className="character-sheet p-6 scroll-container max-h-[700px] overflow-y-auto">
          {/* Character Basic Info */}
          <div className="mb-6 text-secondary border-b-2 border-primary pb-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-fantasy text-xl font-bold text-primary">{character.name}</h3>
              <span className="bg-primary text-white text-sm px-3 py-1 rounded-full">Level {character.level}</span>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-sm text-gray-600">Race</p>
                <p className="font-medium text-secondary">{character.race}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Class</p>
                <p className="font-medium text-secondary">{character.class}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Background</p>
                <p className="font-medium text-secondary">{character.background || "None"}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Alignment</p>
                <p className="font-medium text-secondary">{character.alignment || "None"}</p>
              </div>
            </div>
            
            {/* Guild/Party Affiliations */}
            {memberships.length > 0 && (
              <div className="mt-4 pt-4 border-t border-primary/30">
                <p className="text-sm text-gray-600 mb-2">Affiliations</p>
                <div className="flex flex-wrap gap-2">
                  {memberships.map((m) => {
                    const role = m.role || "member";
                    const RoleIcon = roleIcons[role] || Users;
                    const colorClass = roleColors[role] || "text-gray-400";
                    return (
                      <Badge 
                        key={m.id} 
                        variant="outline" 
                        className="flex items-center gap-1.5 py-1 px-2"
                      >
                        <RoleIcon className={`h-3 w-3 ${colorClass}`} />
                        <span>{m.groupName}</span>
                        {role === "founder" && (
                          <span className="text-xs text-amber-400">(Founder)</span>
                        )}
                        {role === "leader" && (
                          <span className="text-xs text-purple-400">(Leader)</span>
                        )}
                        {m.title && (
                          <span className="text-xs text-muted-foreground">- {m.title}</span>
                        )}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          
          <Tabs defaultValue="main" value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4 flex-wrap">
              <TabsTrigger value="main">Abilities & Combat</TabsTrigger>
              <TabsTrigger value="skills">Skills</TabsTrigger>
              <TabsTrigger value="equipment">Equipment</TabsTrigger>
              <TabsTrigger value="story">
                <div className="flex items-center">
                  <BookOpen className="h-4 w-4 mr-1" />
                  Story
                </div>
              </TabsTrigger>
              <TabsTrigger value="portrait">
                <div className="flex items-center">
                  <Image className="h-4 w-4 mr-1" />
                  Portrait
                </div>
              </TabsTrigger>
              {SPELLCASTING_CLASSES.includes(character.class.toLowerCase()) && (
                <TabsTrigger value="spells">
                  <div className="flex items-center">
                    <Sparkles className="h-4 w-4 mr-1" />
                    Spells
                  </div>
                </TabsTrigger>
              )}
            </TabsList>
            
            <TabsContent value="main">
              {/* Abilities */}
              <div className="mb-6 text-secondary">
                <h3 className="font-fantasy text-lg font-bold mb-3 text-primary-light">Abilities</h3>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="bg-parchment-dark rounded-lg p-3 text-center relative cursor-help">
                          <p className="text-xs text-gray-600">STR</p>
                          <p className="font-bold text-xl text-secondary">{character.strength}</p>
                          <p className="text-secondary text-sm">({formatModifier(getModifier(character.strength))})</p>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="right">
                        <p className="text-sm">Strength measures your character's physical power and affects melee attacks.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="bg-parchment-dark rounded-lg p-3 text-center relative cursor-help">
                          <p className="text-xs text-gray-600">DEX</p>
                          <p className="font-bold text-xl text-secondary">{character.dexterity}</p>
                          <p className="text-secondary text-sm">({formatModifier(getModifier(character.dexterity))})</p>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="right">
                        <p className="text-sm">Dexterity determines agility, reflexes, and balance, affecting ranged attacks and AC.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="bg-parchment-dark rounded-lg p-3 text-center relative cursor-help">
                          <p className="text-xs text-gray-600">CON</p>
                          <p className="font-bold text-xl text-secondary">{character.constitution}</p>
                          <p className="text-secondary text-sm">({formatModifier(getModifier(character.constitution))})</p>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="left">
                        <p className="text-sm">Constitution represents health and stamina, affecting hit points.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="bg-parchment-dark rounded-lg p-3 text-center relative cursor-help">
                          <p className="text-xs text-gray-600">INT</p>
                          <p className="font-bold text-xl text-secondary">{character.intelligence}</p>
                          <p className="text-secondary text-sm">({formatModifier(getModifier(character.intelligence))})</p>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-sm">Intelligence measures reasoning and memory, useful for wizards and knowledge-based skills.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="bg-parchment-dark rounded-lg p-3 text-center relative cursor-help">
                          <p className="text-xs text-gray-600">WIS</p>
                          <p className="font-bold text-xl text-secondary">{character.wisdom}</p>
                          <p className="text-secondary text-sm">({formatModifier(getModifier(character.wisdom))})</p>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-sm">Wisdom reflects perception and insight, important for clerics and druids.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="bg-parchment-dark rounded-lg p-3 text-center relative cursor-help">
                          <p className="text-xs text-gray-600">CHA</p>
                          <p className="font-bold text-xl text-secondary">{character.charisma}</p>
                          <p className="text-secondary text-sm">({formatModifier(getModifier(character.charisma))})</p>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-sm">Charisma measures force of personality, useful for bards, sorcerers, and social interaction.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
              
              {/* Combat Stats */}
              <div className="text-secondary">
                <h3 className="font-fantasy text-lg font-bold mb-3 text-primary-light">Combat</h3>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="bg-parchment-dark rounded-lg p-3 text-center border border-primary">
                    <p className="text-xs text-gray-600">Hit Points</p>
                    <p className="font-bold text-xl text-secondary">{character.hitPoints}/{character.maxHitPoints}</p>
                  </div>
                  
                  <div className="bg-parchment-dark rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-600">Armor Class</p>
                    <p className="font-bold text-xl text-secondary">{character.armorClass}</p>
                  </div>
                  
                  <div className="bg-parchment-dark rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-600">Initiative</p>
                    <p className="font-bold text-xl text-secondary">{formatModifier(getModifier(character.dexterity))}</p>
                  </div>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="skills">
              {/* Skills - D&D 5e Standard Skills */}
              <div className="text-secondary">
                <h3 className="font-fantasy text-lg font-bold mb-3 text-primary-light">Skills</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                  {[
                    { name: "Acrobatics", ability: "dexterity" },
                    { name: "Animal Handling", ability: "wisdom" },
                    { name: "Arcana", ability: "intelligence" },
                    { name: "Athletics", ability: "strength" },
                    { name: "Deception", ability: "charisma" },
                    { name: "History", ability: "intelligence" },
                    { name: "Insight", ability: "wisdom" },
                    { name: "Intimidation", ability: "charisma" },
                    { name: "Investigation", ability: "intelligence" },
                    { name: "Medicine", ability: "wisdom" },
                    { name: "Nature", ability: "intelligence" },
                    { name: "Perception", ability: "wisdom" },
                    { name: "Performance", ability: "charisma" },
                    { name: "Persuasion", ability: "charisma" },
                    { name: "Religion", ability: "intelligence" },
                    { name: "Sleight of Hand", ability: "dexterity" },
                    { name: "Stealth", ability: "dexterity" },
                    { name: "Survival", ability: "wisdom" },
                  ].map((skill) => {
                    const abilityScore = character[skill.ability as keyof typeof character] as number || 10;
                    const baseMod = getModifier(abilityScore);
                    const isProficient = character.skills?.includes(skill.name) || false;
                    const profBonus = Math.ceil(1 + character.level / 4);
                    const totalMod = isProficient ? baseMod + profBonus : baseMod;
                    
                    return (
                      <div 
                        key={skill.name} 
                        className={`flex justify-between items-center py-1 px-2 rounded ${
                          isProficient ? 'bg-primary/10 border-l-2 border-primary' : ''
                        }`}
                      >
                        <div className="flex items-center gap-1">
                          <span className={`w-2 h-2 rounded-full ${isProficient ? 'bg-primary' : 'bg-gray-300'}`} />
                          <span className="text-sm">{skill.name}</span>
                          <span className="text-xs text-gray-500">({skill.ability.slice(0, 3).toUpperCase()})</span>
                        </div>
                        <span className={`font-bold ${isProficient ? 'text-primary' : ''}`}>
                          {formatModifier(totalMod)}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Proficiency Bonus: +{Math.ceil(1 + character.level / 4)} | 
                  Filled circles indicate proficiency
                </p>
              </div>
            </TabsContent>
            
            <TabsContent value="equipment">
              {/* Equipment */}
              <div className="text-secondary">
                <h3 className="font-fantasy text-lg font-bold mb-3 text-primary-light">Equipment</h3>
                <ul className="bg-parchment-dark rounded-lg p-4 space-y-2">
                  {character.equipment && character.equipment.length > 0 ? (
                    character.equipment.map((item, index) => {
                      let itemName = "Unknown Item";
                      let itemType = "Item";
                      let itemDetails = "";
                      
                      if (typeof item === 'object' && item !== null) {
                        const parsed = item as any;
                        itemName = parsed.name || "Unknown Item";
                        itemType = parsed.type || "Item";
                        if (parsed.damage) itemDetails = parsed.damage;
                        else if (parsed.armor) itemDetails = `AC ${parsed.armor}`;
                        else if (parsed.damageDice) itemDetails = parsed.damageDice;
                      } else if (typeof item === 'string') {
                        try {
                          const parsed = JSON.parse(item);
                          itemName = parsed.name || item;
                          itemType = parsed.type || "Item";
                          if (parsed.damage) itemDetails = parsed.damage;
                          else if (parsed.armor) itemDetails = `AC ${parsed.armor}`;
                          else if (parsed.damageDice) itemDetails = parsed.damageDice;
                        } catch {
                          itemName = item;
                        }
                      }
                      
                      return (
                        <li key={index} className="flex justify-between items-center pb-2 border-b border-gray-300">
                          <div>
                            <span className="font-medium">{itemName}</span>
                            {itemDetails && <span className="text-sm text-gray-500 ml-2">({itemDetails})</span>}
                          </div>
                          <span className="text-sm text-gray-600">{itemType}</span>
                        </li>
                      );
                    })
                  ) : (
                    <li className="py-4 text-center">
                      <p>No equipment added yet</p>
                    </li>
                  )}
                </ul>
              </div>
            </TabsContent>
            
            <TabsContent value="story">
              <CharacterStoryArc characterId={character.id} characterName={character.name} />
            </TabsContent>
            
            <TabsContent value="portrait">
              <CharacterPortraitGenerator character={character} />
            </TabsContent>
            
            {SPELLCASTING_CLASSES.includes(character.class.toLowerCase()) && (
              <TabsContent value="spells">
                <SpellBook
                  characterId={character.id}
                  characterClass={character.class}
                  characterLevel={character.level}
                  characterName={character.name}
                  readOnly={false}
                  compact={true}
                />
              </TabsContent>
            )}
          </Tabs>
        </div>
      ) : (
        <div className="p-4 bg-parchment-light">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <h3 className="font-fantasy text-lg font-bold text-primary">{character.name}</h3>
              <span className="text-sm text-gray-600">Level {character.level} {character.race} {character.class}</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="bg-parchment-dark rounded-lg px-2 py-1 text-center">
                <p className="text-xs text-gray-600">HP</p>
                <p className="font-bold text-sm text-secondary">{character.hitPoints}/{character.maxHitPoints}</p>
              </div>
              <div className="bg-parchment-dark rounded-lg px-2 py-1 text-center">
                <p className="text-xs text-gray-600">AC</p>
                <p className="font-bold text-sm text-secondary">{character.armorClass}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}