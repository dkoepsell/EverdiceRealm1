import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Target,
  AlertTriangle,
  Bookmark,
  ChevronDown,
  ChevronUp,
  Edit3,
  Check,
  X,
  Info,
} from "lucide-react";

interface SessionContext {
  sessionName: string;
  sessionFocus: string;
  activePressures: string[];
  unresolvedThread: string;
}

interface SessionContextStripProps {
  campaignId: number | null;
  campaignTitle?: string;
  onSessionStart?: () => void;
}

export default function SessionContextStrip({ 
  campaignId, 
  campaignTitle,
  onSessionStart 
}: SessionContextStripProps) {
  const { toast } = useToast();
  const [isExpanded, setIsExpanded] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [context, setContext] = useState<SessionContext>({
    sessionName: "",
    sessionFocus: "",
    activePressures: [],
    unresolvedThread: "",
  });
  const [pressureInput, setPressureInput] = useState("");

  const { data: sessionData } = useQuery<any>({
    queryKey: [`/api/campaigns/${campaignId}/session-context`],
    enabled: !!campaignId,
  });

  useEffect(() => {
    if (sessionData) {
      setContext({
        sessionName: sessionData.sessionName || `Session ${sessionData.sessionNumber || 1}`,
        sessionFocus: sessionData.sessionFocus || "",
        activePressures: sessionData.activePressures || [],
        unresolvedThread: sessionData.unresolvedThread || "",
      });
    }
  }, [sessionData]);

  const saveContextMutation = useMutation({
    mutationFn: async (data: SessionContext) => {
      return apiRequest("PATCH", `/api/campaigns/${campaignId}/session-context`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/session-context`] });
      setIsEditing(false);
      toast({ title: "Session context saved" });
    },
    onError: () => {
      toast({ title: "Failed to save context", variant: "destructive" });
    },
  });

  const handleAddPressure = () => {
    if (pressureInput.trim() && context.activePressures.length < 3) {
      setContext({
        ...context,
        activePressures: [...context.activePressures, pressureInput.trim()],
      });
      setPressureInput("");
    }
  };

  const handleRemovePressure = (index: number) => {
    setContext({
      ...context,
      activePressures: context.activePressures.filter((_, i) => i !== index),
    });
  };

  const handleSave = () => {
    saveContextMutation.mutate(context);
  };

  const isEmpty = !context.sessionFocus && context.activePressures.length === 0 && !context.unresolvedThread;

  if (!campaignId) {
    return (
      <div className="bg-gradient-to-r from-amber-900/30 via-orange-900/20 to-amber-900/30 border border-amber-500/30 rounded-lg p-4 mb-6">
        <div className="flex items-center gap-3 text-amber-200">
          <Info className="h-5 w-5" />
          <div>
            <p className="font-medium">Select a campaign to begin your session</p>
            <p className="text-sm text-amber-200/70">Choose a campaign from the dropdown above to access the Session Workspace</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-slate-900/80 via-slate-800/60 to-slate-900/80 border border-slate-600/40 rounded-lg mb-6 overflow-hidden">
      <div 
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-white/5 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="font-semibold text-white">
              {context.sessionName || campaignTitle || "Tonight's Session"}
            </span>
          </div>
          {context.sessionFocus && !isExpanded && (
            <span className="text-sm text-slate-400 hidden md:block truncate max-w-md">
              {context.sessionFocus}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isEmpty && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="text-amber-400 border-amber-400/50 text-xs">
                    Setup Recommended
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs">You can run without this, but DMs usually find setting a focus helpful.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-slate-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-400" />
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-slate-700/50 pt-4">
          {/* Session Name - editable */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-slate-400">Session Name:</span>
            {isEditing ? (
              <Input
                value={context.sessionName}
                onChange={(e) => setContext({ ...context, sessionName: e.target.value })}
                placeholder="Tonight's Session"
                className="h-8 max-w-xs bg-slate-800/50 border-slate-600 text-white placeholder:text-slate-500"
              />
            ) : (
              <span 
                className="text-white cursor-pointer hover:bg-white/5 rounded px-2 py-1"
                onClick={() => setIsEditing(true)}
              >
                {context.sessionName || "Click to name this session..."}
              </span>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-300">
                <Target className="h-4 w-4 text-amber-400" />
                Session Focus
              </div>
              {isEditing ? (
                <Input
                  value={context.sessionFocus}
                  onChange={(e) => setContext({ ...context, sessionFocus: e.target.value })}
                  placeholder="Escort the caravan through hostile territory"
                  className="bg-slate-800/50 border-slate-600 text-white placeholder:text-slate-500"
                />
              ) : (
                <p 
                  className={`text-sm ${context.sessionFocus ? 'text-white' : 'text-slate-500 italic'} cursor-pointer hover:bg-white/5 rounded px-2 py-1 -mx-2`}
                  onClick={() => setIsEditing(true)}
                >
                  {context.sessionFocus || "Click to set tonight's goal..."}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-300">
                <AlertTriangle className="h-4 w-4 text-orange-400" />
                Active Pressures
                <span className="text-slate-500 text-xs">({context.activePressures.length}/3)</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {context.activePressures.map((pressure, i) => (
                  <Badge 
                    key={i} 
                    variant="secondary" 
                    className="bg-orange-500/20 text-orange-300 border-orange-500/30 hover:bg-orange-500/30"
                  >
                    {pressure}
                    {isEditing && (
                      <X 
                        className="h-3 w-3 ml-1 cursor-pointer hover:text-white" 
                        onClick={() => handleRemovePressure(i)}
                      />
                    )}
                  </Badge>
                ))}
                {isEditing && context.activePressures.length < 3 && (
                  <div className="flex gap-1">
                    <Input
                      value={pressureInput}
                      onChange={(e) => setPressureInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddPressure()}
                      placeholder="Add pressure..."
                      className="h-7 w-32 text-xs bg-slate-800/50 border-slate-600"
                    />
                  </div>
                )}
                {!isEditing && context.activePressures.length === 0 && (
                  <span 
                    className="text-sm text-slate-500 italic cursor-pointer hover:text-slate-400"
                    onClick={() => setIsEditing(true)}
                  >
                    No active pressures
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-300">
                <Bookmark className="h-4 w-4 text-purple-400" />
                Unresolved Thread
              </div>
              {isEditing ? (
                <Input
                  value={context.unresolvedThread}
                  onChange={(e) => setContext({ ...context, unresolvedThread: e.target.value })}
                  placeholder="The merchant's true identity..."
                  className="bg-slate-800/50 border-slate-600 text-white placeholder:text-slate-500"
                />
              ) : (
                <p 
                  className={`text-sm ${context.unresolvedThread ? 'text-purple-300' : 'text-slate-500 italic'} cursor-pointer hover:bg-white/5 rounded px-2 py-1 -mx-2`}
                  onClick={() => setIsEditing(true)}
                >
                  {context.unresolvedThread || "One dangling question..."}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-700/50">
            {isEditing ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditing(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="h-4 w-4 mr-1" />
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={saveContextMutation.isPending}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Check className="h-4 w-4 mr-1" />
                  Save Context
                </Button>
              </>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditing(true)}
                className="text-slate-400 hover:text-white"
              >
                <Edit3 className="h-4 w-4 mr-1" />
                Edit Session Context
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
