import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Swords,
  Play,
  Pause,
  SkipForward,
  Plus,
  Trash2,
  Crown,
  User,
  Heart,
  Shield,
  ChevronRight,
  Dice6,
  RefreshCw,
} from "lucide-react";

export interface InitiativeCombatant {
  id: string;
  name: string;
  initiative: number;
  isPlayer: boolean;
  characterId?: number;
  hp: number;
  maxHp: number;
  ac: number;
  conditions: string[];
  isCurrentTurn: boolean;
}

interface InitiativeTrackerProps {
  combatants: InitiativeCombatant[];
  currentTurnIndex: number;
  roundNumber: number;
  isInCombat: boolean;
  onStartCombat: () => void;
  onEndCombat: () => void;
  onNextTurn: () => void;
  onAddCombatant: (combatant: Omit<InitiativeCombatant, "id" | "isCurrentTurn">) => void;
  onRemoveCombatant: (id: string) => void;
  onUpdateCombatant: (id: string, updates: Partial<InitiativeCombatant>) => void;
  onRollInitiativeForAll: () => void;
  participants?: any[];
}

const CONDITIONS = [
  "Blinded", "Charmed", "Deafened", "Frightened", "Grappled",
  "Incapacitated", "Invisible", "Paralyzed", "Petrified", "Poisoned",
  "Prone", "Restrained", "Stunned", "Unconscious", "Exhaustion"
];

export default function InitiativeTracker({
  combatants,
  currentTurnIndex,
  roundNumber,
  isInCombat,
  onStartCombat,
  onEndCombat,
  onNextTurn,
  onAddCombatant,
  onRemoveCombatant,
  onUpdateCombatant,
  onRollInitiativeForAll,
  participants = [],
}: InitiativeTrackerProps) {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newName, setNewName] = useState("");
  const [newInitiative, setNewInitiative] = useState(10);
  const [newHp, setNewHp] = useState(20);
  const [newAc, setNewAc] = useState(12);
  const [newIsPlayer, setNewIsPlayer] = useState(false);

  const sortedCombatants = [...combatants].sort((a, b) => b.initiative - a.initiative);

  const handleAddCombatant = () => {
    if (newName.trim()) {
      onAddCombatant({
        name: newName,
        initiative: newInitiative,
        isPlayer: newIsPlayer,
        hp: newHp,
        maxHp: newHp,
        ac: newAc,
        conditions: [],
      });
      setNewName("");
      setNewInitiative(10);
      setNewHp(20);
      setNewAc(12);
      setShowAddDialog(false);
    }
  };

  const getHpColor = (hp: number, maxHp: number) => {
    const percent = (hp / maxHp) * 100;
    if (percent <= 25) return "text-red-400";
    if (percent <= 50) return "text-orange-400";
    if (percent <= 75) return "text-yellow-400";
    return "text-green-400";
  };

  return (
    <Card className="border-slate-700 bg-slate-900/50">
      <CardHeader className="p-3 pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-200">
            <Swords className={`h-4 w-4 ${isInCombat ? "text-red-400 animate-pulse" : "text-slate-400"}`} />
            Initiative
            {isInCombat && (
              <Badge variant="outline" className="text-[10px] bg-red-500/20 text-red-400 border-red-500/30">
                Round {roundNumber}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            {!isInCombat ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs text-amber-400 hover:bg-amber-500/20"
                  onClick={onRollInitiativeForAll}
                  title="Roll initiative for all"
                >
                  <Dice6 className="h-3 w-3 mr-1" />
                  Roll All
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs text-green-400 hover:bg-green-500/20"
                  onClick={onStartCombat}
                >
                  <Play className="h-3 w-3 mr-1" />
                  Start
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs text-amber-400 hover:bg-amber-500/20"
                  onClick={onNextTurn}
                >
                  <SkipForward className="h-3 w-3 mr-1" />
                  Next
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs text-red-400 hover:bg-red-500/20"
                  onClick={onEndCombat}
                >
                  <Pause className="h-3 w-3" />
                </Button>
              </>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 pt-0">
        <ScrollArea className="h-[200px]">
          {sortedCombatants.length > 0 ? (
            <div className="space-y-1">
              {sortedCombatants.map((combatant, idx) => {
                const isCurrentTurn = isInCombat && idx === currentTurnIndex;
                return (
                  <div
                    key={combatant.id}
                    className={`p-2 rounded-lg border transition-all ${
                      isCurrentTurn
                        ? "border-amber-500 bg-amber-500/20 shadow-lg shadow-amber-500/20"
                        : "border-slate-700 bg-slate-800/50 hover:border-slate-600"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {isCurrentTurn && (
                        <ChevronRight className="h-4 w-4 text-amber-400 animate-pulse flex-shrink-0" />
                      )}
                      <div className="flex items-center gap-1 min-w-[32px]">
                        <Badge
                          variant="outline"
                          className={`text-xs px-1.5 ${
                            combatant.isPlayer
                              ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
                              : "bg-red-500/20 text-red-400 border-red-500/30"
                          }`}
                        >
                          {combatant.initiative}
                        </Badge>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          {combatant.isPlayer ? (
                            <User className="h-3 w-3 text-blue-400 flex-shrink-0" />
                          ) : (
                            <Crown className="h-3 w-3 text-red-400 flex-shrink-0" />
                          )}
                          <span className="text-sm font-medium text-slate-200 truncate">
                            {combatant.name}
                          </span>
                        </div>
                        {combatant.conditions.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {combatant.conditions.map((c) => (
                              <Badge
                                key={c}
                                variant="outline"
                                className="text-[9px] px-1 py-0 bg-purple-500/20 text-purple-400 border-purple-500/30"
                              >
                                {c}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs flex-shrink-0">
                        <div className="flex items-center gap-1">
                          <Heart className={`h-3 w-3 ${getHpColor(combatant.hp, combatant.maxHp)}`} />
                          <span className={getHpColor(combatant.hp, combatant.maxHp)}>
                            {combatant.hp}/{combatant.maxHp}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-slate-400">
                          <Shield className="h-3 w-3" />
                          <span>{combatant.ac}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 p-0 text-slate-500 hover:text-red-400"
                          onClick={() => onRemoveCombatant(combatant.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full py-6 text-slate-500">
              <Swords className="h-6 w-6 mb-2 opacity-50" />
              <p className="text-xs text-center">No combatants</p>
              <p className="text-[10px] text-center mt-1">
                Add combatants or start initiative
              </p>
            </div>
          )}
        </ScrollArea>

        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-2 h-7 text-xs border-slate-700 text-slate-300"
            >
              <Plus className="h-3 w-3 mr-1" />
              Add Combatant
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-slate-900 border-slate-700">
            <DialogHeader>
              <DialogTitle>Add Combatant</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-slate-400">Name</label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Goblin, Orc, etc."
                  className="bg-slate-800 border-slate-700"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-sm text-slate-400">Initiative</label>
                  <Input
                    type="number"
                    value={newInitiative}
                    onChange={(e) => setNewInitiative(parseInt(e.target.value) || 0)}
                    className="bg-slate-800 border-slate-700"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-400">HP</label>
                  <Input
                    type="number"
                    value={newHp}
                    onChange={(e) => setNewHp(parseInt(e.target.value) || 1)}
                    className="bg-slate-800 border-slate-700"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-400">AC</label>
                  <Input
                    type="number"
                    value={newAc}
                    onChange={(e) => setNewAc(parseInt(e.target.value) || 10)}
                    className="bg-slate-800 border-slate-700"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant={newIsPlayer ? "default" : "outline"}
                  size="sm"
                  onClick={() => setNewIsPlayer(true)}
                  className={newIsPlayer ? "bg-blue-500" : "border-slate-700"}
                >
                  <User className="h-3 w-3 mr-1" />
                  Player
                </Button>
                <Button
                  variant={!newIsPlayer ? "default" : "outline"}
                  size="sm"
                  onClick={() => setNewIsPlayer(false)}
                  className={!newIsPlayer ? "bg-red-500" : "border-slate-700"}
                >
                  <Crown className="h-3 w-3 mr-1" />
                  NPC/Monster
                </Button>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddCombatant} disabled={!newName.trim()}>
                Add
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
