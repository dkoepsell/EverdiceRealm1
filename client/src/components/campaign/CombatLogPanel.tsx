import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Swords, BookOpen, Dices, Shield, ChevronDown, ChevronUp, Loader2, ScrollText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { annotateRulesTerms } from "@/components/learning/RulesTermTooltip";

interface ActionLogEntry {
  type: 'player_action' | 'narrative' | 'combat' | 'chapter_start';
  timestamp: string;
  text?: string;
  rollResult?: any;
  sceneType?: string;
  attacker?: string;
  target?: string;
  attackRoll?: any;
  isHit?: boolean;
  damage?: any;
  description?: string;
  sessionNumber: number;
  sessionTitle: string;
  chapterNumber?: number;
}

export function CombatLogPanel({ campaignId }: { campaignId: number }) {
  const [filter, setFilter] = useState<'all' | 'combat' | 'actions' | 'narrative'>('all');
  const [expandedEntries, setExpandedEntries] = useState<Set<number>>(new Set());

  const { data: actionLog = [], isLoading } = useQuery<ActionLogEntry[]>({
    queryKey: [`/api/campaigns/${campaignId}/action-log`],
    refetchInterval: 10000,
  });

  const filteredLog = useMemo(() => {
    if (filter === 'all') return actionLog;
    if (filter === 'combat') return actionLog.filter(e => e.type === 'combat');
    if (filter === 'actions') return actionLog.filter(e => e.type === 'player_action');
    if (filter === 'narrative') return actionLog.filter(e => e.type === 'narrative' || e.type === 'chapter_start');
    return actionLog;
  }, [actionLog, filter]);

  const reversedLog = useMemo(() => [...filteredLog].reverse(), [filteredLog]);

  const toggleExpand = (index: number) => {
    setExpandedEntries(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const getEntryIcon = (type: string) => {
    switch (type) {
      case 'combat': return <Swords className="h-4 w-4 text-red-500" />;
      case 'player_action': return <Dices className="h-4 w-4 text-blue-500" />;
      case 'narrative': return <BookOpen className="h-4 w-4 text-amber-500" />;
      case 'chapter_start': return <ScrollText className="h-4 w-4 text-purple-500" />;
      default: return <Shield className="h-4 w-4 text-gray-500" />;
    }
  };

  const getEntryColor = (type: string) => {
    switch (type) {
      case 'combat': return 'border-l-red-500 bg-slate-800';
      case 'player_action': return 'border-l-blue-500 bg-slate-800';
      case 'narrative': return 'border-l-amber-500 bg-slate-800';
      case 'chapter_start': return 'border-l-purple-500 bg-slate-800';
      default: return 'border-l-gray-400 bg-slate-800';
    }
  };

  const getEntryLabel = (type: string) => {
    switch (type) {
      case 'combat': return 'Combat';
      case 'player_action': return 'Action';
      case 'narrative': return 'Story';
      case 'chapter_start': return 'Chapter';
      default: return 'Event';
    }
  };

  const formatTime = (ts: string) => {
    try {
      const d = new Date(ts);
      return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
        <span className="ml-3 text-slate-500">Loading combat log...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold font-fantasy flex items-center gap-2 text-slate-100">
          <Swords className="h-5 w-5 text-red-600" />
          Combat Log
        </h2>
        <span className="text-sm text-slate-500">{actionLog.length} entries</span>
      </div>

      <div className="flex gap-1 flex-wrap">
        {(['all', 'combat', 'actions', 'narrative'] as const).map(f => (
          <Button
            key={f}
            variant={filter === f ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(f)}
            className={filter === f ? "bg-amber-600 hover:bg-amber-700 text-white" : ""}
          >
            {f === 'all' ? 'All' : f === 'combat' ? 'Combat' : f === 'actions' ? 'Actions' : 'Story'}
          </Button>
        ))}
      </div>

      {reversedLog.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <Swords className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium">No entries yet</p>
          <p className="text-sm mt-1">
            {filter === 'all'
              ? "Actions and narratives will appear here as you play."
              : `No ${filter} entries found.`}
          </p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[65vh] overflow-y-auto pr-1">
          {reversedLog.map((entry, index) => {
            const isExpanded = expandedEntries.has(index);
            const isLongText = (entry.text?.length || 0) > 150;

            return (
              <div
                key={index}
                className={`border-l-4 rounded-r-lg p-3 ${getEntryColor(entry.type)} transition-all`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {getEntryIcon(entry.type)}
                    <span className={`text-xs font-bold uppercase px-1.5 py-0.5 rounded ${
                      entry.type === 'combat' ? 'bg-red-900/60 text-red-300' :
                      entry.type === 'player_action' ? 'bg-blue-900/60 text-blue-300' :
                      entry.type === 'chapter_start' ? 'bg-purple-900/60 text-purple-300' :
                      'bg-amber-900/60 text-amber-300'
                    }`}>
                      {getEntryLabel(entry.type)}
                    </span>
                    {entry.sceneType && entry.sceneType !== 'Exploration' && (
                      <span className="text-xs text-slate-300 bg-slate-700/60 px-1.5 py-0.5 rounded">
                        {entry.sceneType}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-slate-300">
                      Scene {entry.sessionNumber}
                    </span>
                    <span className="text-xs text-slate-300">
                      {formatTime(entry.timestamp)}
                    </span>
                  </div>
                </div>

                <div className="mt-2">
                  {entry.type === 'combat' ? (
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-slate-200">
                        {entry.attacker} → {entry.target}
                      </p>
                      {entry.attackRoll && (
                        <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
                          <span className={`px-1.5 py-0.5 rounded ${
                            entry.attackRoll.roll === 20 ? 'bg-yellow-900/60 text-yellow-300' :
                            entry.attackRoll.roll === 1 ? 'bg-red-900/60 text-red-300' :
                            'bg-slate-700/60 text-slate-300'
                          }`}>
                            d20({entry.attackRoll.roll})
                          </span>
                          <span>+ {entry.attackRoll.modifier}</span>
                          <span>= {entry.attackRoll.total}</span>
                          <span className={`font-bold ${entry.isHit ? 'text-green-400' : 'text-red-400'}`}>
                            {entry.attackRoll.roll === 20 ? 'CRITICAL!' : entry.attackRoll.roll === 1 ? 'FUMBLE!' : entry.isHit ? 'HIT' : 'MISS'}
                          </span>
                        </div>
                      )}
                      {entry.isHit && entry.damage && (
                        <div className="text-xs font-mono text-red-400">
                          Damage: {entry.damage.total} ({entry.damage.diceType})
                        </div>
                      )}
                      {entry.description && (
                        <p className="text-xs text-slate-200 italic mt-1">{annotateRulesTerms(entry.description)}</p>
                      )}
                    </div>
                  ) : entry.type === 'player_action' ? (
                    <div>
                      <p className="text-sm font-medium text-slate-200">
                        "{entry.text}"
                      </p>
                      {entry.rollResult && (
                        <p className="text-xs font-mono mt-1 text-blue-400">
                          Roll: {entry.rollResult.total || entry.rollResult.roll || JSON.stringify(entry.rollResult)}
                        </p>
                      )}
                    </div>
                  ) : entry.type === 'chapter_start' ? (
                    <p className="text-sm font-bold text-purple-300">
                      {entry.text}
                    </p>
                  ) : (
                    <div>
                      <p className={`text-sm text-slate-100 leading-relaxed ${
                        !isExpanded && isLongText ? 'line-clamp-3' : ''
                      }`}>
                        {annotateRulesTerms(entry.text || '')}
                      </p>
                      {isLongText && (
                        <button
                          onClick={() => toggleExpand(index)}
                          className="flex items-center gap-1 mt-1 text-xs text-amber-400 hover:text-amber-300 font-medium"
                        >
                          {isExpanded ? (
                            <><ChevronUp className="h-3 w-3" /> Show less</>
                          ) : (
                            <><ChevronDown className="h-3 w-3" /> Read more</>
                          )}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}