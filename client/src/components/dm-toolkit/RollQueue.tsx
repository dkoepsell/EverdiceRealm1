import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dice6,
  User,
  Crown,
  Eye,
  EyeOff,
  Sparkles,
  Skull,
  Check,
  X,
  Clock,
  Plus,
  Users,
} from "lucide-react";
import { DiceRoll } from "./DMDiceRoller";

export interface RollRequest {
  id: string;
  requestedBy: "dm";
  targetPlayer: string;
  targetCharacterId?: number;
  rollType: "initiative" | "attack" | "save" | "check" | "damage" | "custom";
  description: string;
  dc?: number;
  status: "pending" | "completed" | "skipped";
  result?: DiceRoll;
  createdAt: Date;
}

interface RollQueueProps {
  rolls: DiceRoll[];
  requests: RollRequest[];
  onRequestRoll: (request: Omit<RollRequest, "id" | "createdAt" | "status">) => void;
  onClearRolls: () => void;
  onApproveRequest: (requestId: string) => void;
  onSkipRequest: (requestId: string) => void;
  participants?: { id: number; character?: { id: number; name: string } }[];
}

const ROLL_TYPES: { value: RollRequest["rollType"]; label: string }[] = [
  { value: "check", label: "Ability Check" },
  { value: "save", label: "Saving Throw" },
  { value: "attack", label: "Attack Roll" },
  { value: "damage", label: "Damage Roll" },
  { value: "initiative", label: "Initiative" },
  { value: "custom", label: "Custom" },
];

const SAVING_THROWS = [
  "Strength", "Dexterity", "Constitution", "Intelligence", "Wisdom", "Charisma",
];

const SKILLS = [
  "Acrobatics", "Animal Handling", "Arcana", "Athletics", "Deception",
  "History", "Insight", "Intimidation", "Investigation", "Medicine",
  "Nature", "Perception", "Performance", "Persuasion", "Religion",
  "Sleight of Hand", "Stealth", "Survival",
];

const ABILITY_CHECKS = [...SAVING_THROWS, ...SKILLS];

export default function RollQueue({
  rolls,
  requests,
  onRequestRoll,
  onClearRolls,
  onApproveRequest,
  onSkipRequest,
  participants = [],
}: RollQueueProps) {
  const [showRequestDialog, setShowRequestDialog] = useState(false);
  const [requestTarget, setRequestTarget] = useState<string>("all");
  const [requestType, setRequestType] = useState<RollRequest["rollType"]>("check");
  const [requestAbility, setRequestAbility] = useState("Perception");
  const [requestDc, setRequestDc] = useState<number>(15);
  const [requestCustomDesc, setRequestCustomDesc] = useState("");

  const pendingRequests = requests.filter(r => r.status === "pending");
  const recentRolls = rolls.slice(-10);
  const playersWithCharacters = participants.filter(p => p.character);

  const handleSubmitRequest = () => {
    const description = requestType === "custom" 
      ? requestCustomDesc 
      : requestType === "check" 
        ? `${requestAbility} check`
        : requestType === "save"
          ? `${requestAbility} saving throw`
          : `${requestType} roll`;

    if (requestTarget === "all") {
      playersWithCharacters.forEach((p) => {
        if (p.character) {
          onRequestRoll({
            requestedBy: "dm",
            targetPlayer: p.character.name,
            targetCharacterId: p.character.id,
            rollType: requestType,
            description,
            dc: requestDc > 0 ? requestDc : undefined,
          });
        }
      });
    } else {
      const player = playersWithCharacters.find(p => p.character?.name === requestTarget);
      if (player?.character) {
        onRequestRoll({
          requestedBy: "dm",
          targetPlayer: player.character.name,
          targetCharacterId: player.character.id,
          rollType: requestType,
          description,
          dc: requestDc > 0 ? requestDc : undefined,
        });
      }
    }
    setShowRequestDialog(false);
  };

  return (
    <Card className="border-slate-700 bg-slate-900/50">
      <CardHeader className="p-3 pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-200">
            <Dice6 className="h-4 w-4 text-red-400" />
            Roll Log
          </div>
          <div className="flex gap-1">
            <Dialog open={showRequestDialog} onOpenChange={setShowRequestDialog}>
              <DialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs text-amber-400 hover:bg-amber-500/20"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Request
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-slate-900 border-slate-700">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-amber-400" />
                    Request Roll from Players
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-slate-400 mb-1 block">Who should roll?</label>
                    <Select value={requestTarget} onValueChange={setRequestTarget}>
                      <SelectTrigger className="bg-slate-800 border-slate-700">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Everyone</SelectItem>
                        {playersWithCharacters.map((p) => (
                          <SelectItem key={p.id} value={p.character?.name || ""}>
                            {p.character?.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm text-slate-400 mb-1 block">Roll Type</label>
                    <Select value={requestType} onValueChange={(v) => setRequestType(v as any)}>
                      <SelectTrigger className="bg-slate-800 border-slate-700">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLL_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {requestType === "check" && (
                    <div>
                      <label className="text-sm text-slate-400 mb-1 block">Ability/Skill</label>
                      <Select value={requestAbility} onValueChange={setRequestAbility}>
                        <SelectTrigger className="bg-slate-800 border-slate-700">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ABILITY_CHECKS.map((ability) => (
                            <SelectItem key={ability} value={ability}>
                              {ability}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {requestType === "save" && (
                    <div>
                      <label className="text-sm text-slate-400 mb-1 block">Saving Throw</label>
                      <Select value={requestAbility} onValueChange={setRequestAbility}>
                        <SelectTrigger className="bg-slate-800 border-slate-700">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SAVING_THROWS.map((ability) => (
                            <SelectItem key={ability} value={ability}>
                              {ability}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {requestType === "custom" && (
                    <div>
                      <label className="text-sm text-slate-400 mb-1 block">Description</label>
                      <Input
                        value={requestCustomDesc}
                        onChange={(e) => setRequestCustomDesc(e.target.value)}
                        placeholder="What are they rolling for?"
                        className="bg-slate-800 border-slate-700"
                      />
                    </div>
                  )}
                  <div>
                    <label className="text-sm text-slate-400 mb-1 block">DC (optional)</label>
                    <Input
                      type="number"
                      value={requestDc || ""}
                      onChange={(e) => setRequestDc(parseInt(e.target.value) || 0)}
                      placeholder="Difficulty Class"
                      className="bg-slate-800 border-slate-700 w-24"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowRequestDialog(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSubmitRequest} className="bg-amber-500 hover:bg-amber-600">
                    Request Roll
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            {recentRolls.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-slate-400"
                onClick={onClearRolls}
              >
                Clear
              </Button>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 pt-0">
        {/* Pending Roll Requests */}
        {pendingRequests.length > 0 && (
          <div className="mb-3 space-y-2">
            <p className="text-[10px] uppercase tracking-wider text-amber-400">Awaiting Rolls</p>
            {pendingRequests.map((request) => (
              <div
                key={request.id}
                className="p-2 rounded-lg border border-amber-500/30 bg-amber-500/10"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] bg-amber-500/20 text-amber-400 border-amber-500/30">
                        {request.rollType}
                      </Badge>
                      <span className="text-sm font-medium text-slate-200">{request.targetPlayer}</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">{request.description}</p>
                    {request.dc && (
                      <p className="text-xs text-slate-500">DC {request.dc}</p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 text-green-400 hover:bg-green-500/20"
                      onClick={() => onApproveRequest(request.id)}
                    >
                      <Check className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 text-slate-400 hover:bg-slate-500/20"
                      onClick={() => onSkipRequest(request.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Roll History */}
        <ScrollArea className="h-[180px]">
          {recentRolls.length > 0 ? (
            <div className="space-y-2">
              {recentRolls.slice().reverse().map((roll) => (
                <div
                  key={roll.id}
                  className={`p-2 rounded-lg border transition-all ${
                    roll.isCritical
                      ? "border-green-500/50 bg-green-500/10"
                      : roll.isFumble
                      ? "border-red-500/50 bg-red-500/10"
                      : "border-slate-700 bg-slate-800/50"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      {roll.rollerType === "dm" ? (
                        <Crown className="h-3 w-3 text-amber-400" />
                      ) : (
                        <User className="h-3 w-3 text-blue-400" />
                      )}
                      <span className="text-xs font-medium text-slate-300">{roll.roller}</span>
                      {!roll.isPublic && (
                        <EyeOff className="h-3 w-3 text-slate-500" />
                      )}
                    </div>
                    <span className="text-[10px] text-slate-500">
                      {roll.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] bg-slate-700/50 border-slate-600">
                        {roll.dice}
                      </Badge>
                      {roll.purpose && (
                        <span className="text-xs text-slate-400">{roll.purpose}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <span
                        className={`text-lg font-bold ${
                          roll.isCritical
                            ? "text-green-400"
                            : roll.isFumble
                            ? "text-red-400"
                            : "text-white"
                        }`}
                      >
                        {roll.total}
                      </span>
                      {roll.isCritical && <Sparkles className="h-4 w-4 text-green-400" />}
                      {roll.isFumble && <Skull className="h-4 w-4 text-red-400" />}
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">
                    [{roll.breakdown.join(", ")}]
                    {roll.modifier !== 0 && ` ${roll.modifier > 0 ? "+" : ""}${roll.modifier}`}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full py-6 text-slate-500">
              <Dice6 className="h-6 w-6 mb-2 opacity-50" />
              <p className="text-xs text-center">No rolls yet</p>
              <p className="text-[10px] text-center mt-1">
                Roll dice or request player rolls
              </p>
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
