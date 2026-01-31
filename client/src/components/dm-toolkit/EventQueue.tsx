import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Check,
  X,
  Edit2,
  Clock,
  User,
  Bot,
  Cog,
  MapPin,
  Sword,
  MessageSquare,
  Search,
  Puzzle,
  Loader2,
  Plus,
  ChevronUp,
  ChevronDown,
} from "lucide-react";

export type EventSource = "player" | "ai" | "system" | "map";
export type EventType = "narrative" | "mechanical" | "state" | "meta";
export type IntentClassification = "dialogue" | "investigation" | "combat" | "stealth" | "ingenuity" | "endurance";

export interface PendingEvent {
  id: string;
  source: EventSource;
  type: EventType;
  intent?: IntentClassification;
  title: string;
  description: string;
  impact: string;
  affectedEntities: string[];
  timestamp: Date;
  isReversible: boolean;
}

interface EventQueueProps {
  events: PendingEvent[];
  onApprove: (eventId: string) => void;
  onReject: (eventId: string) => void;
  onModify: (eventId: string) => void;
  onAddEvent?: (event: PendingEvent) => void;
  isProcessing?: string | null;
}

const SOURCE_CONFIG: Record<EventSource, { icon: typeof User; label: string; color: string }> = {
  player: { icon: User, label: "Player", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  ai: { icon: Bot, label: "AI", color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  system: { icon: Cog, label: "System", color: "bg-slate-500/20 text-slate-400 border-slate-500/30" },
  map: { icon: MapPin, label: "Map", color: "bg-green-500/20 text-green-400 border-green-500/30" },
};

const TYPE_CONFIG: Record<EventType, { icon: typeof MessageSquare; label: string }> = {
  narrative: { icon: MessageSquare, label: "Narrative" },
  mechanical: { icon: Sword, label: "Mechanical" },
  state: { icon: Cog, label: "State Change" },
  meta: { icon: Clock, label: "Meta" },
};

const INTENT_CONFIG: Record<IntentClassification, { icon: typeof Sword; color: string }> = {
  dialogue: { icon: MessageSquare, color: "text-blue-400" },
  investigation: { icon: Search, color: "text-cyan-400" },
  combat: { icon: Sword, color: "text-red-400" },
  stealth: { icon: User, color: "text-slate-400" },
  ingenuity: { icon: Puzzle, color: "text-purple-400" },
  endurance: { icon: Cog, color: "text-amber-400" },
};

export default function EventQueue({
  events,
  onApprove,
  onReject,
  onModify,
  onAddEvent,
  isProcessing,
}: EventQueueProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEvent, setNewEvent] = useState({
    title: "",
    description: "",
    impact: "",
    type: "narrative" as EventType,
    intent: "" as IntentClassification | "",
    affectedEntities: "",
  });

  const handleAddEvent = () => {
    if (!newEvent.title.trim() || !newEvent.description.trim()) return;
    
    const event: PendingEvent = {
      id: `dm-${Date.now()}`,
      source: "system",
      type: newEvent.type,
      intent: newEvent.intent || undefined,
      title: newEvent.title.trim(),
      description: newEvent.description.trim(),
      impact: newEvent.impact.trim() || "DM-initiated event",
      affectedEntities: newEvent.affectedEntities.split(",").map(e => e.trim()).filter(Boolean),
      timestamp: new Date(),
      isReversible: true,
    };
    
    onAddEvent?.(event);
    setNewEvent({ title: "", description: "", impact: "", type: "narrative", intent: "", affectedEntities: "" });
    setShowAddForm(false);
  };

  return (
    <Card className="border-slate-700 bg-slate-900/50">
      <CardHeader className="p-3 pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-200">
            <Clock className="h-4 w-4 text-amber-400" />
            Event Queue
          </div>
          <div className="flex items-center gap-2">
            {events.length > 0 && (
              <Badge variant="outline" className="text-xs bg-amber-500/20 text-amber-400 border-amber-500/30">
                {events.length} pending
              </Badge>
            )}
            {onAddEvent && (
              <Button
                size="sm"
                variant="outline"
                className="h-6 text-xs bg-emerald-500/20 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/30"
                onClick={() => setShowAddForm(!showAddForm)}
              >
                {showAddForm ? <ChevronUp className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
              </Button>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 pt-0">
        {showAddForm && (
          <div className="mb-3 p-3 rounded-lg border bg-slate-800/70 border-emerald-500/30 space-y-2">
            <div className="flex items-center gap-2 text-xs text-emerald-400 font-medium mb-2">
              <Plus className="h-3 w-3" />
              Create Custom Event
            </div>
            <Input
              placeholder="Event title (e.g., 'Goblin Ambush')"
              value={newEvent.title}
              onChange={(e) => setNewEvent(prev => ({ ...prev, title: e.target.value }))}
              className="h-8 text-xs bg-slate-900/50 border-slate-600"
            />
            <Textarea
              placeholder="Description of what happens..."
              value={newEvent.description}
              onChange={(e) => setNewEvent(prev => ({ ...prev, description: e.target.value }))}
              className="text-xs bg-slate-900/50 border-slate-600 min-h-[60px]"
            />
            <div className="grid grid-cols-2 gap-2">
              <Select
                value={newEvent.type}
                onValueChange={(value: EventType) => setNewEvent(prev => ({ ...prev, type: value }))}
              >
                <SelectTrigger className="h-8 text-xs bg-slate-900/50 border-slate-600">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="narrative">Narrative</SelectItem>
                  <SelectItem value="mechanical">Mechanical</SelectItem>
                  <SelectItem value="state">State Change</SelectItem>
                  <SelectItem value="meta">Meta</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={newEvent.intent || "none"}
                onValueChange={(value) => setNewEvent(prev => ({ ...prev, intent: value === "none" ? "" : value as IntentClassification }))}
              >
                <SelectTrigger className="h-8 text-xs bg-slate-900/50 border-slate-600">
                  <SelectValue placeholder="Intent (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No intent</SelectItem>
                  <SelectItem value="dialogue">Dialogue</SelectItem>
                  <SelectItem value="investigation">Investigation</SelectItem>
                  <SelectItem value="combat">Combat</SelectItem>
                  <SelectItem value="stealth">Stealth</SelectItem>
                  <SelectItem value="ingenuity">Ingenuity</SelectItem>
                  <SelectItem value="endurance">Endurance</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Input
              placeholder="Impact (optional)"
              value={newEvent.impact}
              onChange={(e) => setNewEvent(prev => ({ ...prev, impact: e.target.value }))}
              className="h-8 text-xs bg-slate-900/50 border-slate-600"
            />
            <Input
              placeholder="Affected entities (comma-separated, optional)"
              value={newEvent.affectedEntities}
              onChange={(e) => setNewEvent(prev => ({ ...prev, affectedEntities: e.target.value }))}
              className="h-8 text-xs bg-slate-900/50 border-slate-600"
            />
            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                className="flex-1 h-7 text-xs bg-emerald-500/20 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/30"
                variant="outline"
                onClick={handleAddEvent}
                disabled={!newEvent.title.trim() || !newEvent.description.trim()}
              >
                <Plus className="h-3 w-3 mr-1" />
                Add to Queue
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs bg-slate-700/50 border-slate-600 text-slate-300 hover:bg-slate-600"
                onClick={() => setShowAddForm(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
        <ScrollArea className={showAddForm ? "h-[120px]" : "h-[200px]"}>
          {events.length > 0 ? (
            <div className="space-y-2">
              {events.map((event) => {
                const sourceConfig = SOURCE_CONFIG[event.source];
                const typeConfig = TYPE_CONFIG[event.type];
                const intentConfig = event.intent ? INTENT_CONFIG[event.intent] : null;
                const SourceIcon = sourceConfig.icon;
                const TypeIcon = typeConfig.icon;
                const IntentIcon = intentConfig?.icon;
                const processing = isProcessing === event.id;

                return (
                  <div
                    key={event.id}
                    className={`p-3 rounded-lg border bg-slate-800/50 border-slate-700 transition-all ${
                      processing ? "opacity-50" : "hover:border-amber-500/50"
                    }`}
                  >
                    {/* Header with source and type */}
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline" className={`text-[10px] ${sourceConfig.color}`}>
                        <SourceIcon className="h-3 w-3 mr-1" />
                        {sourceConfig.label}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] bg-slate-700/50 text-slate-300 border-slate-600">
                        <TypeIcon className="h-3 w-3 mr-1" />
                        {typeConfig.label}
                      </Badge>
                      {intentConfig && IntentIcon && (
                        <Badge variant="outline" className={`text-[10px] bg-slate-700/50 border-slate-600 ${intentConfig.color}`}>
                          <IntentIcon className="h-3 w-3 mr-1" />
                          {event.intent}
                        </Badge>
                      )}
                    </div>

                    {/* Title and description */}
                    <h4 className="font-medium text-sm text-slate-200 mb-1">{event.title}</h4>
                    <p className="text-xs text-slate-400 mb-2">{event.description}</p>

                    {/* Impact preview */}
                    <div className="p-2 rounded bg-slate-900/50 border border-slate-700 mb-2">
                      <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Impact</p>
                      <p className="text-xs text-slate-300">{event.impact}</p>
                      {event.affectedEntities.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {event.affectedEntities.map((entity, i) => (
                            <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">
                              {entity}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 h-7 text-xs bg-green-500/20 border-green-500/30 text-green-400 hover:bg-green-500/30"
                        onClick={() => onApprove(event.id)}
                        disabled={processing}
                      >
                        {processing ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <>
                            <Check className="h-3 w-3 mr-1" />
                            Approve
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs bg-slate-700/50 border-slate-600 text-slate-300 hover:bg-slate-600"
                        onClick={() => onModify(event.id)}
                        disabled={processing}
                      >
                        <Edit2 className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs bg-red-500/20 border-red-500/30 text-red-400 hover:bg-red-500/30"
                        onClick={() => onReject(event.id)}
                        disabled={processing}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full py-8 text-slate-500">
              <Clock className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm font-medium">No pending events</p>
              <p className="text-xs text-center mt-1">
                Events from players, AI, and the map will appear here for your approval
              </p>
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
