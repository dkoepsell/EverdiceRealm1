import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Dice6, Sparkles, Eye, EyeOff, Plus, Minus } from "lucide-react";

export interface DiceRoll {
  id: string;
  dice: string;
  result: number;
  breakdown: number[];
  modifier: number;
  total: number;
  roller: string;
  rollerType: "dm" | "player";
  isPublic: boolean;
  isCritical: boolean;
  isFumble: boolean;
  timestamp: Date;
  purpose?: string;
}

interface DMDiceRollerProps {
  onRoll: (roll: DiceRoll) => void;
  compact?: boolean;
}

const DICE_TYPES = [
  { sides: 4, label: "d4", color: "bg-green-500" },
  { sides: 6, label: "d6", color: "bg-blue-500" },
  { sides: 8, label: "d8", color: "bg-purple-500" },
  { sides: 10, label: "d10", color: "bg-orange-500" },
  { sides: 12, label: "d12", color: "bg-pink-500" },
  { sides: 20, label: "d20", color: "bg-red-500" },
  { sides: 100, label: "d100", color: "bg-slate-500" },
];

export default function DMDiceRoller({ onRoll, compact = false }: DMDiceRollerProps) {
  const [diceCount, setDiceCount] = useState(1);
  const [modifier, setModifier] = useState(0);
  const [isPublic, setIsPublic] = useState(true);
  const [lastRoll, setLastRoll] = useState<DiceRoll | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [purpose, setPurpose] = useState("");

  const rollDice = (sides: number) => {
    const rolls: number[] = [];
    for (let i = 0; i < diceCount; i++) {
      rolls.push(Math.floor(Math.random() * sides) + 1);
    }
    const result = rolls.reduce((a, b) => a + b, 0);
    const total = result + modifier;
    
    const isCritical = sides === 20 && diceCount === 1 && rolls[0] === 20;
    const isFumble = sides === 20 && diceCount === 1 && rolls[0] === 1;

    const roll: DiceRoll = {
      id: `roll-${Date.now()}`,
      dice: `${diceCount}d${sides}${modifier !== 0 ? (modifier > 0 ? `+${modifier}` : modifier) : ""}`,
      result,
      breakdown: rolls,
      modifier,
      total,
      roller: "Dungeon Master",
      rollerType: "dm",
      isPublic,
      isCritical,
      isFumble,
      timestamp: new Date(),
      purpose: purpose || undefined,
    };

    setLastRoll(roll);
    setShowResult(true);
    onRoll(roll);

    setTimeout(() => setShowResult(false), 3000);
  };

  if (compact) {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 border-slate-600 text-slate-300 hover:bg-slate-800"
          >
            <Dice6 className="h-4 w-4" />
            Roll
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 bg-slate-900 border-slate-700" align="start">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-sm text-slate-200">DM Dice Roller</h4>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsPublic(!isPublic)}
                className={`h-7 px-2 text-xs ${isPublic ? "text-green-400" : "text-slate-400"}`}
              >
                {isPublic ? <Eye className="h-3 w-3 mr-1" /> : <EyeOff className="h-3 w-3 mr-1" />}
                {isPublic ? "Public" : "Hidden"}
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center border border-slate-700 rounded">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => setDiceCount(Math.max(1, diceCount - 1))}
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <span className="w-8 text-center text-sm">{diceCount}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => setDiceCount(Math.min(20, diceCount + 1))}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              <span className="text-slate-400 text-sm">dice</span>
              <div className="flex items-center border border-slate-700 rounded ml-auto">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => setModifier(modifier - 1)}
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <span className="w-10 text-center text-sm">
                  {modifier >= 0 ? `+${modifier}` : modifier}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => setModifier(modifier + 1)}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>

            <Input
              placeholder="Purpose (optional, e.g., Attack roll)"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              className="h-8 text-sm bg-slate-800 border-slate-700"
            />

            <div className="grid grid-cols-4 gap-2">
              {DICE_TYPES.map(({ sides, label, color }) => (
                <Button
                  key={sides}
                  variant="outline"
                  size="sm"
                  className={`h-10 text-xs border-slate-600 hover:${color} hover:text-white transition-colors`}
                  onClick={() => rollDice(sides)}
                >
                  {label}
                </Button>
              ))}
              <Button
                variant="outline"
                size="sm"
                className="h-10 text-xs border-amber-500/50 text-amber-400 hover:bg-amber-500 hover:text-white"
                onClick={() => {
                  const roll1 = Math.floor(Math.random() * 20) + 1;
                  const roll2 = Math.floor(Math.random() * 20) + 1;
                  const best = Math.max(roll1, roll2);
                  const total = best + modifier;
                  const roll: DiceRoll = {
                    id: `roll-${Date.now()}`,
                    dice: `2d20kh1${modifier !== 0 ? (modifier > 0 ? `+${modifier}` : modifier) : ""}`,
                    result: best,
                    breakdown: [roll1, roll2],
                    modifier,
                    total,
                    roller: "Dungeon Master",
                    rollerType: "dm",
                    isPublic,
                    isCritical: roll1 === 20 || roll2 === 20,
                    isFumble: roll1 === 1 && roll2 === 1,
                    timestamp: new Date(),
                    purpose: purpose ? `${purpose} (Adv)` : "Advantage",
                  };
                  setLastRoll(roll);
                  setShowResult(true);
                  onRoll(roll);
                  setTimeout(() => setShowResult(false), 3000);
                }}
              >
                Adv
              </Button>
            </div>

            {showResult && lastRoll && (
              <div className={`p-3 rounded-lg text-center ${
                lastRoll.isCritical ? "bg-green-500/20 border border-green-500" :
                lastRoll.isFumble ? "bg-red-500/20 border border-red-500" :
                "bg-slate-800 border border-slate-700"
              }`}>
                <div className="text-xs text-slate-400 mb-1">
                  {lastRoll.dice} {lastRoll.purpose && `• ${lastRoll.purpose}`}
                </div>
                <div className={`text-3xl font-bold ${
                  lastRoll.isCritical ? "text-green-400" :
                  lastRoll.isFumble ? "text-red-400" :
                  "text-white"
                }`}>
                  {lastRoll.total}
                  {lastRoll.isCritical && <Sparkles className="inline h-5 w-5 ml-2 animate-pulse" />}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  [{lastRoll.breakdown.join(", ")}]{lastRoll.modifier !== 0 && ` ${lastRoll.modifier > 0 ? "+" : ""}${lastRoll.modifier}`}
                </div>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <div className="p-3 rounded-lg border border-slate-700 bg-slate-800/50 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Dice6 className="h-4 w-4 text-red-400" />
          <h4 className="font-medium text-sm text-slate-200">DM Dice Roller</h4>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsPublic(!isPublic)}
          className={`h-7 px-2 text-xs ${isPublic ? "text-green-400" : "text-slate-400"}`}
        >
          {isPublic ? <Eye className="h-3 w-3 mr-1" /> : <EyeOff className="h-3 w-3 mr-1" />}
          {isPublic ? "Public" : "Hidden"}
        </Button>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2">
        <div className="flex items-center border border-slate-700 rounded bg-slate-900/50">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-slate-400 hover:text-white"
            onClick={() => setDiceCount(Math.max(1, diceCount - 1))}
          >
            <Minus className="h-3 w-3" />
          </Button>
          <span className="w-6 text-center text-sm text-slate-200">{diceCount}</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-slate-400 hover:text-white"
            onClick={() => setDiceCount(Math.min(20, diceCount + 1))}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
        <span className="text-slate-500 text-xs">×</span>
        <div className="flex items-center border border-slate-700 rounded bg-slate-900/50 ml-auto">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-slate-400 hover:text-white"
            onClick={() => setModifier(modifier - 1)}
          >
            <Minus className="h-3 w-3" />
          </Button>
          <span className="w-10 text-center text-sm text-slate-200">
            {modifier >= 0 ? `+${modifier}` : modifier}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-slate-400 hover:text-white"
            onClick={() => setModifier(modifier + 1)}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Purpose input */}
      <Input
        placeholder="Purpose (e.g., Attack, Perception)"
        value={purpose}
        onChange={(e) => setPurpose(e.target.value)}
        className="h-8 text-xs bg-slate-900/50 border-slate-700"
      />

      {/* Dice grid */}
      <div className="grid grid-cols-4 gap-1.5">
        {DICE_TYPES.map(({ sides, label, color }) => (
          <Button
            key={sides}
            variant="outline"
            size="sm"
            className={`h-10 text-sm font-medium border-slate-600 bg-slate-900/50 hover:bg-red-500/20 hover:border-red-500/50 hover:text-red-400 transition-colors`}
            onClick={() => rollDice(sides)}
          >
            {label}
          </Button>
        ))}
        <Button
          variant="outline"
          size="sm"
          className="h-10 text-sm font-medium border-amber-500/50 text-amber-400 bg-amber-500/10 hover:bg-amber-500/20"
          onClick={() => {
            const roll1 = Math.floor(Math.random() * 20) + 1;
            const roll2 = Math.floor(Math.random() * 20) + 1;
            const best = Math.max(roll1, roll2);
            const total = best + modifier;
            const roll: DiceRoll = {
              id: `roll-${Date.now()}`,
              dice: `2d20kh1${modifier !== 0 ? (modifier > 0 ? `+${modifier}` : modifier) : ""}`,
              result: best,
              breakdown: [roll1, roll2],
              modifier,
              total,
              roller: "Dungeon Master",
              rollerType: "dm",
              isPublic,
              isCritical: best === 20,
              isFumble: false,
              timestamp: new Date(),
              purpose: purpose ? `${purpose} (Adv)` : "Advantage",
            };
            setLastRoll(roll);
            setShowResult(true);
            onRoll(roll);
            setTimeout(() => setShowResult(false), 3000);
          }}
        >
          Adv
        </Button>
      </div>

      {/* Last roll result */}
      {showResult && lastRoll && (
        <div className={`p-3 rounded-lg text-center animate-in fade-in ${
          lastRoll.isCritical ? "bg-green-500/20 border border-green-500" :
          lastRoll.isFumble ? "bg-red-500/20 border border-red-500" :
          "bg-slate-900/50 border border-slate-700"
        }`}>
          <div className="text-xs text-slate-400 mb-1">
            {lastRoll.dice} {lastRoll.purpose && `• ${lastRoll.purpose}`}
          </div>
          <div className={`text-3xl font-bold ${
            lastRoll.isCritical ? "text-green-400" :
            lastRoll.isFumble ? "text-red-400" :
            "text-white"
          }`}>
            {lastRoll.total}
            {lastRoll.isCritical && <Sparkles className="inline h-5 w-5 ml-2 animate-pulse" />}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">
            [{lastRoll.breakdown.join(", ")}]{lastRoll.modifier !== 0 && ` ${lastRoll.modifier > 0 ? "+" : ""}${lastRoll.modifier}`}
          </div>
        </div>
      )}
    </div>
  );
}
