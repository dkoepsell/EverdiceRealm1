import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { 
  Heart, 
  Shield, 
  Zap, 
  Eye, 
  Clock,
  Target,
  Minus,
  Plus,
  RotateCcw
} from "lucide-react";

interface PlayerStatus {
  id: number;
  name: string;
  characterName: string;
  level: number;
  class: string;
  race: string;
  hp: number;
  maxHp: number;
  ac: number;
  spellSlots: { [level: string]: { current: number; max: number } };
  conditions: string[];
  inspiration: boolean;
  deathSaves: { successes: number; failures: number };
  isOnline: boolean;
  lastActivity: string;
}

interface RealTimePlayerDashboardProps {
  campaignId: number;
}

export default function RealTimePlayerDashboard({ campaignId }: RealTimePlayerDashboardProps) {
  const [selectedPlayer, setSelectedPlayer] = useState<number | null>(null);
  
  // Fetch live player data with frequent updates
  const { data: players = [], isLoading } = useQuery<PlayerStatus[]>({
    queryKey: [`/api/campaigns/${campaignId}/players/status`],
    refetchInterval: 2000, // Update every 2 seconds
    enabled: !!campaignId
  });

  const applyDamage = async (playerId: number, damage: number) => {
    try {
      await fetch(`/api/campaigns/${campaignId}/players/${playerId}/damage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ damage })
      });
    } catch (error) {
      console.error('Failed to apply damage:', error);
    }
  };

  const applyHealing = async (playerId: number, healing: number) => {
    try {
      await fetch(`/api/campaigns/${campaignId}/players/${playerId}/heal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ healing })
      });
    } catch (error) {
      console.error('Failed to apply healing:', error);
    }
  };

  const addCondition = async (playerId: number, condition: string) => {
    try {
      await fetch(`/api/campaigns/${campaignId}/players/${playerId}/conditions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ condition })
      });
    } catch (error) {
      console.error('Failed to add condition:', error);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading player status...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Live Player Status</h3>
        <Badge variant="secondary">{players.length} Players Online</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {players.map((player) => (
          <Card key={player.id} className={`transition-all ${player.isOnline ? 'border-green-300' : 'border-gray-300'}`}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">
                  {player.characterName}
                </CardTitle>
                <div className="flex items-center space-x-1">
                  <div className={`w-2 h-2 rounded-full ${player.isOnline ? 'bg-green-500' : 'bg-gray-400'}`} />
                  <span className="text-xs text-muted-foreground">
                    {player.isOnline ? 'Online' : 'Offline'}
                  </span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Level {player.level} {player.race} {player.class}
              </p>
            </CardHeader>
            
            <CardContent className="space-y-3">
              {/* Health */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center space-x-1">
                    <Heart className="h-3 w-3 text-red-500" />
                    <span>HP</span>
                  </div>
                  <span className="font-mono">{player.hp}/{player.maxHp}</span>
                </div>
                <Progress 
                  value={(player.hp / player.maxHp) * 100} 
                  className="h-2"
                />
                <div className="flex space-x-1">
                  <Button 
                    size="sm" 
                    variant="destructive" 
                    className="h-6 px-2 text-xs"
                    onClick={() => applyDamage(player.id, 5)}
                  >
                    <Minus className="h-3 w-3" />
                    5
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="h-6 px-2 text-xs"
                    onClick={() => applyHealing(player.id, 5)}
                  >
                    <Plus className="h-3 w-3" />
                    5
                  </Button>
                </div>
              </div>

              {/* AC */}
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center space-x-1">
                  <Shield className="h-3 w-3 text-blue-500" />
                  <span>AC</span>
                </div>
                <span className="font-mono">{player.ac}</span>
              </div>

              {/* Spell Slots */}
              {Object.keys(player.spellSlots).length > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center space-x-1 text-sm">
                    <Zap className="h-3 w-3 text-purple-500" />
                    <span>Spell Slots</span>
                  </div>
                  {Object.entries(player.spellSlots).map(([level, slots]) => (
                    <div key={level} className="flex items-center justify-between text-xs">
                      <span>Level {level}</span>
                      <div className="flex space-x-1">
                        {Array.from({ length: slots.max }, (_, i) => (
                          <div
                            key={i}
                            className={`w-2 h-2 rounded-full border ${
                              i < slots.current ? 'bg-purple-500 border-purple-500' : 'border-gray-300'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Conditions */}
              {player.conditions.length > 0 && (
                <div className="space-y-1">
                  <span className="text-sm">Conditions</span>
                  <div className="flex flex-wrap gap-1">
                    {player.conditions.map((condition, index) => (
                      <Badge key={index} variant="destructive" className="text-xs">
                        {condition}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Death Saves */}
              {player.hp === 0 && (
                <div className="space-y-1">
                  <span className="text-sm text-red-600">Death Saves</span>
                  <div className="flex justify-between text-xs">
                    <div className="flex items-center space-x-1">
                      <span>Success:</span>
                      <div className="flex space-x-1">
                        {Array.from({ length: 3 }, (_, i) => (
                          <div
                            key={i}
                            className={`w-2 h-2 rounded-full border ${
                              i < player.deathSaves.successes ? 'bg-green-500 border-green-500' : 'border-gray-300'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center space-x-1">
                      <span>Failure:</span>
                      <div className="flex space-x-1">
                        {Array.from({ length: 3 }, (_, i) => (
                          <div
                            key={i}
                            className={`w-2 h-2 rounded-full border ${
                              i < player.deathSaves.failures ? 'bg-red-500 border-red-500' : 'border-gray-300'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Inspiration */}
              {player.inspiration && (
                <Badge variant="secondary" className="text-xs">
                  <Eye className="h-3 w-3 mr-1" />
                  Inspiration
                </Badge>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}