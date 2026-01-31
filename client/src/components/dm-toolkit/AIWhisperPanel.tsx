import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  MessageSquare,
  Lightbulb,
  AlertTriangle,
  Clock,
  Users,
  MapPin,
  Sparkles,
  ChevronRight,
} from "lucide-react";

export type WhisperType = "hook" | "reminder" | "consequence" | "npc_note" | "pacing";

export interface AIWhisper {
  id: string;
  type: WhisperType;
  content: string;
  context?: string;
  priority: "low" | "medium" | "high";
  relatedTo?: string;
  timestamp: Date;
}

interface AIWhisperPanelProps {
  whispers: AIWhisper[];
  onDismiss: (whisperId: string) => void;
  onUseAsInspiration: (whisper: AIWhisper) => void;
}

const WHISPER_CONFIG: Record<WhisperType, { icon: typeof Lightbulb; label: string; color: string }> = {
  hook: { icon: Sparkles, label: "Story Hook", color: "text-amber-400" },
  reminder: { icon: Clock, label: "Reminder", color: "text-blue-400" },
  consequence: { icon: AlertTriangle, label: "Consequence", color: "text-orange-400" },
  npc_note: { icon: Users, label: "NPC", color: "text-green-400" },
  pacing: { icon: MapPin, label: "Pacing", color: "text-purple-400" },
};

const PRIORITY_STYLES: Record<string, string> = {
  low: "border-slate-700",
  medium: "border-slate-600",
  high: "border-amber-500/50 bg-amber-500/5",
};

export default function AIWhisperPanel({
  whispers,
  onDismiss,
  onUseAsInspiration,
}: AIWhisperPanelProps) {
  return (
    <Card className="border-purple-500/30 bg-gradient-to-b from-purple-500/5 to-transparent">
      <CardHeader className="p-3 pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-purple-400" />
          <span className="text-purple-300">AI Whispers</span>
          <Badge variant="outline" className="text-[10px] ml-auto bg-purple-500/20 text-purple-300 border-purple-500/30">
            Suggestions Only
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 pt-0">
        <ScrollArea className="h-[180px]">
          {whispers.length > 0 ? (
            <div className="space-y-2">
              {whispers.map((whisper) => {
                const config = WHISPER_CONFIG[whisper.type];
                const Icon = config.icon;

                return (
                  <div
                    key={whisper.id}
                    className={`p-2.5 rounded-lg border transition-all hover:bg-purple-500/10 ${PRIORITY_STYLES[whisper.priority]}`}
                  >
                    <div className="flex items-start gap-2">
                      <Icon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${config.color}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[10px] uppercase tracking-wider ${config.color}`}>
                            {config.label}
                          </span>
                          {whisper.relatedTo && (
                            <span className="text-[10px] text-slate-500">
                              → {whisper.relatedTo}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-300 leading-relaxed">
                          {whisper.content}
                        </p>
                        {whisper.context && (
                          <p className="text-xs text-slate-500 mt-1 italic">
                            {whisper.context}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 text-[10px] text-purple-400 hover:text-purple-300 hover:bg-purple-500/20"
                            onClick={() => onUseAsInspiration(whisper)}
                          >
                            <ChevronRight className="h-3 w-3 mr-1" />
                            Use as inspiration
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 text-[10px] text-slate-500 hover:text-slate-400"
                            onClick={() => onDismiss(whisper.id)}
                          >
                            Dismiss
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full py-6 text-slate-500">
              <Lightbulb className="h-6 w-6 mb-2 opacity-50" />
              <p className="text-xs text-center">
                AI suggestions will appear here as the session progresses
              </p>
              <p className="text-[10px] text-center mt-1 text-slate-600">
                The AI observes but never acts without your approval
              </p>
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
