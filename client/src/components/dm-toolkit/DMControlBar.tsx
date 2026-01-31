import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Pause,
  Play,
  Undo2,
  Save,
  Pencil,
  Zap,
  History,
  AlertCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export type SessionMode = "exploration" | "social" | "combat" | "puzzle" | "downtime" | "travel";

interface Checkpoint {
  id: string;
  name: string;
  timestamp: Date;
  state: any;
}

interface DMControlBarProps {
  campaignId: number | null;
  isPaused: boolean;
  onPauseToggle: () => void;
  sessionMode: SessionMode;
  onModeChange: (mode: SessionMode) => void;
  onUndo: () => void;
  canUndo: boolean;
  onCheckpoint: (name: string) => void;
  onRestoreCheckpoint: (checkpoint: Checkpoint) => void;
  checkpoints: Checkpoint[];
  onInjectNarration: (text: string) => void;
  onForceStateChange: (change: { type: string; target: string; value: any }) => void;
}

const SESSION_MODES: { value: SessionMode; label: string; color: string }[] = [
  { value: "exploration", label: "Exploration", color: "bg-green-500" },
  { value: "social", label: "Social", color: "bg-blue-500" },
  { value: "combat", label: "Combat", color: "bg-red-500" },
  { value: "puzzle", label: "Puzzle", color: "bg-purple-500" },
  { value: "downtime", label: "Downtime", color: "bg-amber-500" },
  { value: "travel", label: "Travel", color: "bg-cyan-500" },
];

export default function DMControlBar({
  campaignId,
  isPaused,
  onPauseToggle,
  sessionMode,
  onModeChange,
  onUndo,
  canUndo,
  onCheckpoint,
  onRestoreCheckpoint,
  checkpoints,
  onInjectNarration,
  onForceStateChange,
}: DMControlBarProps) {
  const { toast } = useToast();
  const [injectDialogOpen, setInjectDialogOpen] = useState(false);
  const [checkpointDialogOpen, setCheckpointDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [forceDialogOpen, setForceDialogOpen] = useState(false);
  
  const [narrationText, setNarrationText] = useState("");
  const [checkpointName, setCheckpointName] = useState("");
  const [forceChangeType, setForceChangeType] = useState("hp");
  const [forceChangeTarget, setForceChangeTarget] = useState("");
  const [forceChangeValue, setForceChangeValue] = useState("");

  const currentMode = SESSION_MODES.find(m => m.value === sessionMode) || SESSION_MODES[0];

  const handleInjectNarration = () => {
    if (narrationText.trim()) {
      onInjectNarration(narrationText);
      setNarrationText("");
      setInjectDialogOpen(false);
      toast({ title: "Narration Injected", description: "Your text has been added to the scene." });
    }
  };

  const handleCreateCheckpoint = () => {
    if (checkpointName.trim()) {
      onCheckpoint(checkpointName);
      setCheckpointName("");
      setCheckpointDialogOpen(false);
      toast({ title: "Checkpoint Created", description: `"${checkpointName}" saved successfully.` });
    }
  };

  const handleForceStateChange = () => {
    if (forceChangeTarget.trim() && forceChangeValue.trim()) {
      onForceStateChange({
        type: forceChangeType,
        target: forceChangeTarget,
        value: forceChangeValue,
      });
      setForceChangeTarget("");
      setForceChangeValue("");
      setForceDialogOpen(false);
      toast({ title: "State Updated", description: "The change has been applied." });
    }
  };

  if (!campaignId) {
    return null;
  }

  return (
    <div className="bg-slate-900 border-b border-slate-700 px-4 py-2 flex items-center gap-3 flex-wrap sticky top-0 z-50">
      {/* Pause/Resume - Most critical control */}
      <Button
        variant={isPaused ? "default" : "outline"}
        size="sm"
        onClick={onPauseToggle}
        className={`gap-2 ${isPaused ? "bg-amber-500 hover:bg-amber-600 text-white" : "border-slate-600 text-slate-300 hover:bg-slate-800"}`}
      >
        {isPaused ? (
          <>
            <Play className="h-4 w-4" />
            Resume
          </>
        ) : (
          <>
            <Pause className="h-4 w-4" />
            Pause
          </>
        )}
      </Button>

      {isPaused && (
        <Badge variant="outline" className="bg-amber-500/20 text-amber-400 border-amber-500/50 animate-pulse">
          Session Paused
        </Badge>
      )}

      <div className="h-6 w-px bg-slate-700" />

      {/* Undo */}
      <Button
        variant="outline"
        size="sm"
        onClick={onUndo}
        disabled={!canUndo}
        className="gap-2 border-slate-600 text-slate-300 hover:bg-slate-800 disabled:opacity-50"
      >
        <Undo2 className="h-4 w-4" />
        Undo
      </Button>

      {/* Checkpoint */}
      <Dialog open={checkpointDialogOpen} onOpenChange={setCheckpointDialogOpen}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 border-slate-600 text-slate-300 hover:bg-slate-800"
          >
            <Save className="h-4 w-4" />
            Checkpoint
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Checkpoint</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="checkpoint-name">Checkpoint Name</Label>
              <Input
                id="checkpoint-name"
                value={checkpointName}
                onChange={(e) => setCheckpointName(e.target.value)}
                placeholder="e.g., Before the boss fight"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCheckpointDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateCheckpoint} disabled={!checkpointName.trim()}>
              Save Checkpoint
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History/Restore */}
      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 border-slate-600 text-slate-300 hover:bg-slate-800"
          >
            <History className="h-4 w-4" />
            History
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Session Checkpoints</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {checkpoints.length > 0 ? (
              checkpoints.map((cp) => (
                <div
                  key={cp.id}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50"
                >
                  <div>
                    <p className="font-medium">{cp.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(cp.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      onRestoreCheckpoint(cp);
                      setHistoryDialogOpen(false);
                      toast({ title: "Checkpoint Restored", description: `Restored to "${cp.name}"` });
                    }}
                  >
                    Restore
                  </Button>
                </div>
              ))
            ) : (
              <p className="text-center text-muted-foreground py-8">
                No checkpoints yet. Create one to save your progress.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <div className="h-6 w-px bg-slate-700" />

      {/* Inject Narration */}
      <Dialog open={injectDialogOpen} onOpenChange={setInjectDialogOpen}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 border-slate-600 text-slate-300 hover:bg-slate-800"
          >
            <Pencil className="h-4 w-4" />
            Inject
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Inject Narration</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              value={narrationText}
              onChange={(e) => setNarrationText(e.target.value)}
              placeholder="Enter narration text to inject into the scene..."
              className="min-h-[120px]"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInjectDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleInjectNarration} disabled={!narrationText.trim()}>
              Inject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Force State Change */}
      <Dialog open={forceDialogOpen} onOpenChange={setForceDialogOpen}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 border-slate-600 text-slate-300 hover:bg-slate-800"
          >
            <Zap className="h-4 w-4" />
            Override
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              Force State Change
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Change Type</Label>
              <Select value={forceChangeType} onValueChange={setForceChangeType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hp">HP</SelectItem>
                  <SelectItem value="condition">Condition</SelectItem>
                  <SelectItem value="location">Location</SelectItem>
                  <SelectItem value="flag">Story Flag</SelectItem>
                  <SelectItem value="npc_status">NPC Status</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Target</Label>
              <Input
                value={forceChangeTarget}
                onChange={(e) => setForceChangeTarget(e.target.value)}
                placeholder="e.g., Character name or NPC"
              />
            </div>
            <div>
              <Label>New Value</Label>
              <Input
                value={forceChangeValue}
                onChange={(e) => setForceChangeValue(e.target.value)}
                placeholder="e.g., 25 or poisoned"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setForceDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleForceStateChange}
              disabled={!forceChangeTarget.trim() || !forceChangeValue.trim()}
              className="bg-amber-500 hover:bg-amber-600"
            >
              Apply Override
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex-1" />

      {/* Session Mode Selector */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-400">Mode:</span>
        <Select value={sessionMode} onValueChange={(v) => onModeChange(v as SessionMode)}>
          <SelectTrigger className="w-[140px] h-8 bg-slate-800 border-slate-600 text-slate-200">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${currentMode.color}`} />
              <SelectValue />
            </div>
          </SelectTrigger>
          <SelectContent>
            {SESSION_MODES.map((mode) => (
              <SelectItem key={mode.value} value={mode.value}>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${mode.color}`} />
                  {mode.label}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
