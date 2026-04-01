import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronUp, Gauge, FastForward, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type PacingMode = 'relaxed' | 'standard' | 'brisk';

interface StoryControlsProps {
  campaignId: number;
  currentChapter: number;
  totalChapters: number;
  scenesInChapter: number;
  pacingMode: PacingMode;
  onPacingChange: (mode: PacingMode) => void;
  onChapterAdvanced: () => void;
}

const PACING_OPTIONS: { mode: PacingMode; label: string; desc: string; icon: React.ReactNode }[] = [
  {
    mode: 'relaxed',
    label: 'Relaxed',
    desc: 'Long, narrative-rich chapters (~20 scenes)',
    icon: <Gauge className="h-3 w-3" />,
  },
  {
    mode: 'standard',
    label: 'Standard',
    desc: 'Balanced pacing (~10 scenes per chapter)',
    icon: <FastForward className="h-3 w-3" />,
  },
  {
    mode: 'brisk',
    label: 'Brisk',
    desc: 'Fast story progression (~7 scenes per chapter)',
    icon: <Zap className="h-3 w-3" />,
  },
];

export function StoryControls({
  campaignId,
  currentChapter,
  totalChapters,
  scenesInChapter,
  pacingMode,
  onPacingChange,
  onChapterAdvanced,
}: StoryControlsProps) {
  const [expanded, setExpanded] = useState(false);
  const [confirmingAdvance, setConfirmingAdvance] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const forceAdvance = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/campaigns/${campaignId}/force-advance-chapter`, {});
      return res.json();
    },
    onSuccess: (data) => {
      setConfirmingAdvance(false);
      toast({
        title: `Chapter ${data.chapter} begins`,
        description: `Advanced from Chapter ${currentChapter} — good luck, DM!`,
      });
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/sessions`] });
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}`] });
      onChapterAdvanced();
    },
    onError: (err: any) => {
      setConfirmingAdvance(false);
      toast({ title: "Couldn't advance chapter", description: err.message, variant: "destructive" });
    },
  });

  const handlePacingChange = (mode: PacingMode) => {
    onPacingChange(mode);
    localStorage.setItem('dm_pacing_mode', mode);
    toast({
      title: `Pacing set to ${mode}`,
      description: mode === 'brisk'
        ? 'Chapters will advance after ~7 scenes.'
        : mode === 'relaxed'
        ? 'Chapters will advance after ~20 scenes.'
        : 'Standard pacing — chapters advance after ~10 scenes.',
    });
  };

  const atFinalChapter = currentChapter >= totalChapters;

  return (
    <div className="mt-3 rounded-lg border border-amber-800/40 bg-amber-950/20 overflow-hidden">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-amber-900/20 transition-colors"
      >
        <span className="flex items-center gap-2 text-xs font-semibold text-amber-400 uppercase tracking-widest">
          <Gauge className="h-3.5 w-3.5" />
          DM Story Controls
        </span>
        <ChevronUp
          className={`h-3.5 w-3.5 text-amber-500/60 transition-transform duration-200 ${expanded ? '' : 'rotate-180'}`}
        />
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-3 animate-in fade-in slide-in-from-top-1 duration-150">
          {/* Chapter status */}
          <div className="flex items-center gap-2 pt-1">
            <span className="text-xs text-amber-300/70">
              Chapter <span className="font-bold text-amber-300">{currentChapter}</span> of{' '}
              <span className="font-bold text-amber-300">{totalChapters}</span>
            </span>
            <span className="text-amber-700/50 text-xs">·</span>
            <span className="text-xs text-amber-300/50">
              {scenesInChapter} scene{scenesInChapter !== 1 ? 's' : ''} this chapter
            </span>
            {atFinalChapter && (
              <Badge variant="outline" className="text-xs border-amber-600 text-amber-400 ml-auto">
                Final Chapter
              </Badge>
            )}
          </div>

          {/* Pacing selector */}
          <div>
            <p className="text-xs text-amber-400/60 mb-1.5 font-medium">Story Pacing</p>
            <div className="grid grid-cols-3 gap-1.5">
              {PACING_OPTIONS.map(({ mode, label, desc }) => (
                <button
                  key={mode}
                  onClick={() => handlePacingChange(mode)}
                  title={desc}
                  className={`flex flex-col items-center gap-0.5 px-2 py-2 rounded text-xs font-medium border transition-colors ${
                    pacingMode === mode
                      ? 'border-amber-500 bg-amber-900/50 text-amber-300'
                      : 'border-amber-800/30 bg-amber-950/10 text-amber-400/50 hover:border-amber-600/50 hover:text-amber-400'
                  }`}
                >
                  <span>{label}</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-amber-400/40 mt-1">
              {PACING_OPTIONS.find(p => p.mode === pacingMode)?.desc}
            </p>
          </div>

          {/* Force advance */}
          <div className="border-t border-amber-800/30 pt-3">
            {!confirmingAdvance ? (
              <Button
                variant="outline"
                size="sm"
                disabled={atFinalChapter || forceAdvance.isPending}
                onClick={() => setConfirmingAdvance(true)}
                className="w-full text-xs border-amber-700/50 text-amber-400 hover:bg-amber-900/40 hover:text-amber-300 disabled:opacity-30"
              >
                <ChevronUp className="h-3.5 w-3.5 mr-1.5" />
                {atFinalChapter ? 'Already at final chapter' : 'Force Advance Chapter'}
              </Button>
            ) : (
              <div className="space-y-1.5">
                <p className="text-xs text-amber-300/80 text-center">
                  Skip to Chapter {currentChapter + 1}? This can't be undone.
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setConfirmingAdvance(false)}
                    className="flex-1 text-xs border-amber-800/40 text-amber-500/60 hover:text-amber-400"
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => forceAdvance.mutate()}
                    disabled={forceAdvance.isPending}
                    className="flex-1 text-xs bg-amber-700 hover:bg-amber-600 text-white"
                  >
                    {forceAdvance.isPending ? 'Advancing…' : 'Yes, advance'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
