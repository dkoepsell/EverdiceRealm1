import { useState } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Character } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Image } from "lucide-react";
import CharacterPortraitGenerator from "./CharacterPortraitGenerator";

interface CharacterSheetProps {
  character: Character;
}

export default function CharacterSheet({ character }: CharacterSheetProps) {
  const [activeTab, setActiveTab] = useState("main");
  const [isExpanded, setIsExpanded] = useState(true);

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
          </div>
          
          <Tabs defaultValue="main" value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="main">Abilities & Combat</TabsTrigger>
              <TabsTrigger value="skills">Skills</TabsTrigger>
              <TabsTrigger value="equipment">Equipment</TabsTrigger>
              <TabsTrigger value="portrait">
                <div className="flex items-center">
                  <Image className="h-4 w-4 mr-1" />
                  Portrait
                </div>
              </TabsTrigger>
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
              {/* Skills */}
              <div className="text-secondary">
                <h3 className="font-fantasy text-lg font-bold mb-3 text-primary-light">Skills</h3>
                <div className="grid grid-cols-2 gap-2">
                  {character.skills && character.skills.length > 0 ? (
                    character.skills.map((skill, index) => (
                      <div key={index} className="flex justify-between items-center py-1 border-b border-gray-300">
                        <span className="text-sm">{skill}</span>
                        <span className="font-bold">+3</span>
                      </div>
                    ))
                  ) : (
                    <div className="col-span-2 py-4 text-center">
                      <p>No skills added yet</p>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="equipment">
              {/* Equipment */}
              <div className="text-secondary">
                <h3 className="font-fantasy text-lg font-bold mb-3 text-primary-light">Equipment</h3>
                <ul className="bg-parchment-dark rounded-lg p-4 space-y-2">
                  {character.equipment && character.equipment.length > 0 ? (
                    character.equipment.map((item, index) => (
                      <li key={index} className="flex justify-between items-center pb-2 border-b border-gray-300">
                        <span>{item}</span>
                        <span className="text-sm text-gray-600">Item</span>
                      </li>
                    ))
                  ) : (
                    <li className="py-4 text-center">
                      <p>No equipment added yet</p>
                    </li>
                  )}
                </ul>
              </div>
            </TabsContent>
            
            <TabsContent value="portrait">
              {/* Character Portrait Generator */}
              <CharacterPortraitGenerator character={character} />
            </TabsContent>
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