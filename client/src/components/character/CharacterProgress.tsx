import { Progress } from "@/components/ui/progress";
import { Character } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatModifier, getAbilityModifier } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// XP thresholds for each level in D&D 5e
const XP_THRESHOLDS = [
  0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000,
  85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000
];

interface CharacterProgressProps {
  character: Character;
}

export default function CharacterProgress({ character }: CharacterProgressProps) {
  const currentXP = character.experience || 0;
  const currentLevel = character.level || 1;
  
  // Calculate XP needed for next level
  const nextLevelXP = currentLevel < 20 ? XP_THRESHOLDS[currentLevel] : Infinity;
  const previousLevelXP = XP_THRESHOLDS[currentLevel - 1];
  
  // Calculate progress percentage
  const levelProgress = currentLevel >= 20 
    ? 100 
    : Math.floor(((currentXP - previousLevelXP) / (nextLevelXP - previousLevelXP)) * 100);
  
  // Calculate XP needed for next level
  const xpForNextLevel = currentLevel >= 20 ? 0 : nextLevelXP - currentXP;

  return (
    <Card className="w-full overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-xl font-bold">
            {character.name}
          </CardTitle>
          <div className="flex items-center space-x-2">
            <Badge variant="outline" className="bg-primary/10 text-primary-foreground">
              {character.race}
            </Badge>
            <Badge variant="outline" className="bg-primary/10 text-primary-foreground">
              {character.class}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="grid gap-4">
          {/* Level and XP */}
          <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-2">
            <div className="flex flex-col">
              <div className="flex items-center">
                <span className="text-3xl font-bold">{currentLevel}</span>
                <span className="text-sm text-muted-foreground ml-2">Level</span>
              </div>
              <div className="text-sm text-muted-foreground">
                {currentXP.toLocaleString()} XP total
              </div>
            </div>
            
            {currentLevel < 20 && (
              <div className="text-right">
                <div className="text-sm text-muted-foreground">
                  Next level at {nextLevelXP.toLocaleString()} XP
                </div>
                <div className="text-sm font-medium">
                  {xpForNextLevel.toLocaleString()} XP needed
                </div>
              </div>
            )}
          </div>
          
          {/* Progress Bar */}
          <div className="space-y-1.5">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="w-full">
                    <Progress value={levelProgress} className="h-2.5 w-full" />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  {currentLevel < 20 
                    ? `${levelProgress}% progress to level ${currentLevel + 1}` 
                    : 'Maximum level reached'}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          
          {/* Character Stats */}
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mt-2">
            {[
              { name: 'STR', value: character.strength },
              { name: 'DEX', value: character.dexterity },
              { name: 'CON', value: character.constitution },
              { name: 'INT', value: character.intelligence },
              { name: 'WIS', value: character.wisdom },
              { name: 'CHA', value: character.charisma }
            ].map((stat) => (
              <div 
                key={stat.name}
                className="flex flex-col items-center justify-center p-2 bg-secondary/30 rounded-md"
              >
                <span className="text-xs font-semibold text-muted-foreground">{stat.name}</span>
                <span className="text-lg font-bold">{stat.value}</span>
                <span className="text-xs">{formatModifier(getAbilityModifier(stat.value))}</span>
              </div>
            ))}
          </div>
          
          {/* Brief Character Info */}
          <div className="flex flex-wrap gap-2 mt-2">
            <div className="flex items-center space-x-2 bg-destructive/10 px-2 py-1 rounded border border-destructive/20">
              <span className="text-sm font-semibold text-destructive">HP:</span>
              <span className="text-sm font-bold text-foreground">{character.hitPoints}/{character.maxHitPoints}</span>
            </div>
            <div className="flex items-center space-x-2 bg-primary/10 px-2 py-1 rounded border border-primary/20">
              <span className="text-sm font-semibold text-primary">AC:</span>
              <span className="text-sm font-bold text-foreground">{character.armorClass}</span>
            </div>
            {character.background && (
              <div className="flex items-center space-x-2">
                <span className="text-sm font-semibold">Background:</span>
                <span className="text-sm">{character.background}</span>
              </div>
            )}
            {character.alignment && (
              <div className="flex items-center space-x-2">
                <span className="text-sm font-semibold">Alignment:</span>
                <span className="text-sm">{character.alignment}</span>
              </div>
            )}
          </div>
          
        </div>
      </CardContent>
    </Card>
  );
}