import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Map } from "lucide-react";
import { DungeonMap, type DungeonMapData, type MapEntity } from "./DungeonMap";
import { generateDungeon, movePlayer, updateVisibility } from "./DungeonGenerator";
import { useToast } from "@/hooks/use-toast";

interface DungeonMapModalProps {
  campaignId?: number;
  campaignName?: string;
  dungeonLevel?: number;
  onTileInteraction?: (x: number, y: number, tileType: string) => void;
  onEntityInteraction?: (entity: MapEntity) => void;
  onExitDungeon?: () => void;
  initialMapData?: DungeonMapData | null;
  onMapDataChange?: (mapData: DungeonMapData) => void;
}

export function DungeonMapModal({
  campaignId,
  campaignName,
  dungeonLevel = 1,
  onTileInteraction,
  onEntityInteraction,
  onExitDungeon,
  initialMapData,
  onMapDataChange,
}: DungeonMapModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mapData, setMapData] = useState<DungeonMapData | null>(initialMapData || null);
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (initialMapData) {
      setMapData(initialMapData);
    }
  }, [initialMapData]);

  const handleGenerateNewDungeon = () => {
    const newMap = generateDungeon({
      width: 25,
      height: 18,
      maxRooms: 6,
      dungeonLevel,
      dungeonName: campaignName ? `${campaignName} - Level ${dungeonLevel}` : undefined,
    });
    setMapData(newMap);
    onMapDataChange?.(newMap);
    toast({
      title: "Dungeon Generated",
      description: `Welcome to ${newMap.name}!`,
    });
  };

  const handlePlayerMove = (direction: "up" | "down" | "left" | "right") => {
    if (!mapData) return;
    
    const oldPosition = mapData.playerPosition;
    const newMapData = movePlayer(mapData, direction);
    
    if (newMapData.playerPosition.x !== oldPosition.x || newMapData.playerPosition.y !== oldPosition.y) {
      setMapData(newMapData);
      onMapDataChange?.(newMapData);
      
      const newTile = newMapData.tiles[newMapData.playerPosition.y][newMapData.playerPosition.x];
      
      if (newTile.type === "trap") {
        toast({
          title: "Trap!",
          description: "You've triggered a trap! Roll a Dexterity saving throw.",
          variant: "destructive",
        });
        onTileInteraction?.(newMapData.playerPosition.x, newMapData.playerPosition.y, "trap");
      } else if (newTile.type === "treasure") {
        toast({
          title: "Treasure Found!",
          description: "You've discovered a treasure chest!",
        });
        onTileInteraction?.(newMapData.playerPosition.x, newMapData.playerPosition.y, "treasure");
      } else if (newTile.type === "stairs_down") {
        toast({
          title: "Stairs",
          description: "You've found stairs leading deeper into the dungeon.",
        });
        onTileInteraction?.(newMapData.playerPosition.x, newMapData.playerPosition.y, "stairs_down");
      } else if (newTile.type === "door") {
        toast({
          title: "Door",
          description: "You pass through the doorway.",
        });
      }
      
      const nearbyEnemies = newMapData.entities.filter(
        e => e.type === "enemy" || e.type === "boss"
      ).filter(e => {
        const dist = Math.sqrt(
          Math.pow(e.x - newMapData.playerPosition.x, 2) + 
          Math.pow(e.y - newMapData.playerPosition.y, 2)
        );
        return dist <= 1.5;
      });
      
      if (nearbyEnemies.length > 0) {
        toast({
          title: "Combat!",
          description: `${nearbyEnemies.map(e => e.name).join(", ")} ${nearbyEnemies.length > 1 ? "are" : "is"} nearby!`,
          variant: "destructive",
        });
        nearbyEnemies.forEach(e => onEntityInteraction?.(e));
      }
    }
  };

  const handleTileClick = (x: number, y: number) => {
    if (!mapData) return;
    const tile = mapData.tiles[y][x];
    onTileInteraction?.(x, y, tile.type);
  };

  const handleEntityClick = (entity: MapEntity) => {
    setSelectedEntity(entity.id === selectedEntity ? null : entity.id);
    onEntityInteraction?.(entity);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="gap-2"
          data-testid="button-open-dungeon-map"
        >
          <Map className="w-4 h-4" />
          Dungeon Map
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Map className="w-5 h-5" />
            {mapData?.name || "Dungeon Explorer"}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {!mapData ? (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <p className="text-muted-foreground text-center">
                No dungeon map loaded. Generate a new dungeon to explore!
              </p>
              <Button 
                onClick={handleGenerateNewDungeon}
                data-testid="button-generate-dungeon"
              >
                Generate Dungeon
              </Button>
            </div>
          ) : (
            <>
              <DungeonMap
                mapData={mapData}
                onTileClick={handleTileClick}
                onEntityClick={handleEntityClick}
                onPlayerMove={handlePlayerMove}
                interactive={true}
                showControls={true}
                selectedEntity={selectedEntity}
              />
              
              <div className="flex justify-between items-center pt-2 border-t">
                <div className="text-sm text-muted-foreground">
                  Position: ({mapData.playerPosition.x}, {mapData.playerPosition.y})
                  {mapData.entities.length > 0 && (
                    <span className="ml-4">
                      Enemies: {mapData.entities.filter(e => e.type === "enemy" || e.type === "boss").length}
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleGenerateNewDungeon}
                    data-testid="button-regenerate-dungeon"
                  >
                    New Dungeon
                  </Button>
                  {onExitDungeon && (
                    <Button 
                      variant="secondary" 
                      size="sm"
                      onClick={() => {
                        onExitDungeon();
                        setIsOpen(false);
                      }}
                      data-testid="button-exit-dungeon"
                    >
                      Exit Dungeon
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
