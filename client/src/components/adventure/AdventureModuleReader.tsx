import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  X,
  BookOpen,
  MapPin,
  Users,
  Sword,
  Package,
  Shield,
  AlertTriangle,
  Crosshair,
  GitFork,
  Scroll,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  Sparkles,
  Flame,
  Eye,
  MessageSquare,
  Puzzle,
  Compass,
  Crown,
  Target,
  Layers,
  Clock
} from 'lucide-react';

interface CAML2Data {
  caml_version?: string;
  meta?: {
    id?: string;
    title?: string;
    created_utc?: string;
    authors?: string[];
    tags?: string[];
    levels?: { min?: number; max?: number };
    summary?: string;
    table_of_contents?: Array<{ chapter: number; title: string; summary: string }>;
  };
  doctrine?: {
    campaign_question?: string;
    stakes?: Array<{
      id?: string;
      name?: string;
      value?: number;
      max?: number;
      drift?: string;
      driftRate?: number;
      thresholdConsequence?: {
        at0?: { event?: string; irreversible?: boolean };
        at5?: { event?: string; irreversible?: boolean };
      };
    }>;
  };
  world?: {
    entities?: {
      characters?: Array<any>;
      locations?: Array<any>;
      items?: Array<any>;
      factions?: Array<any>;
    };
    connections?: Array<any>;
  };
  state?: {
    facts?: Array<any>;
  };
  roles?: {
    assignments?: Array<any>;
  };
  processes?: {
    catalog?: Array<any>;
  };
  transitions?: {
    changes?: Array<any>;
  };
  snapshots?: {
    timeline?: Array<any>;
  };
}

interface AdventureModuleReaderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  camlData: CAML2Data | null;
  onCreateCampaign?: () => void;
}

const processTypeIcons: Record<string, any> = {
  combat: Sword,
  social: MessageSquare,
  puzzle: Puzzle,
  exploration: Compass,
};

const processTypeColors: Record<string, string> = {
  combat: 'text-red-400 bg-red-500/10 border-red-500/20',
  social: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  puzzle: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  exploration: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
};

const rarityColors: Record<string, string> = {
  common: 'text-gray-300',
  uncommon: 'text-green-400',
  rare: 'text-blue-400',
  'very rare': 'text-purple-400',
  legendary: 'text-amber-400',
  artifact: 'text-red-400',
};

export function AdventureModuleReader({ open, onOpenChange, camlData, onCreateCampaign }: AdventureModuleReaderProps) {
  const [activeSection, setActiveSection] = useState('overview');
  const contentRef = useRef<HTMLDivElement>(null);

  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (open) setActiveSection('overview');
  }, [open]);

  if (!camlData) return null;

  const meta = camlData.meta || {};
  const doctrine = camlData.doctrine || {};
  const world = camlData.world?.entities || {};
  const connections = camlData.world?.connections || [];
  const stateFacts = camlData.state?.facts || [];
  const roles = camlData.roles?.assignments || [];
  const processes = camlData.processes?.catalog || [];
  const transitions = camlData.transitions?.changes || [];
  const snapshots = camlData.snapshots?.timeline || [];
  const toc = meta.table_of_contents || [];
  const npcs = (world.characters || []).filter((c: any) => !c.pc);
  const locations = world.locations || [];
  const items = world.items || [];
  const factions = world.factions || [];
  const openingSnapshot = snapshots.find((s: any) => s.id?.includes('Initial') || s.id?.includes('Opening'));
  const endingSnapshots = snapshots.filter((s: any) => s.id?.includes('Ending') || s.derived_from_transition);

  const scrollToSection = (id: string) => {
    setActiveSection(id);
    sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const getNpcAttitude = (npcId: string) => {
    const fact = stateFacts.find((f: any) => f.bearer === npcId && f.type === 'attitude');
    return fact?.value || 'unknown';
  };

  const attitudeColor = (att: string) => {
    if (att === 'friendly') return 'text-green-400';
    if (att === 'hostile') return 'text-red-400';
    if (att === 'neutral') return 'text-yellow-400';
    return 'text-gray-400';
  };

  const tocSections = [
    { id: 'overview', label: 'Overview', icon: BookOpen },
    ...(doctrine.campaign_question ? [{ id: 'doctrine', label: 'The Dilemma', icon: Target }] : []),
    ...(locations.length > 0 ? [{ id: 'locations', label: `Locations (${locations.length})`, icon: MapPin }] : []),
    ...(npcs.length > 0 ? [{ id: 'npcs', label: `Characters (${npcs.length})`, icon: Users }] : []),
    ...(items.length > 0 ? [{ id: 'items', label: `Items (${items.length})`, icon: Package }] : []),
    ...(processes.length > 0 ? [{ id: 'chapters', label: `Chapters (${processes.length})`, icon: Layers }] : []),
    ...(endingSnapshots.length > 0 ? [{ id: 'endings', label: `Endings (${endingSnapshots.length})`, icon: GitFork }] : []),
    ...(connections.length > 0 ? [{ id: 'map', label: 'Connections', icon: Compass }] : []),
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-[1200px] h-[90vh] p-0 gap-0 bg-gradient-to-b from-slate-950 to-slate-900 border-amber-900/30 overflow-hidden [&>button]:hidden">
        <div className="flex h-full">
          {/* Sidebar TOC */}
          <div className="w-64 flex-shrink-0 border-r border-amber-900/20 bg-slate-950/80 flex flex-col">
            <div className="p-4 border-b border-amber-900/20">
              <div className="flex items-center justify-between mb-2">
                <Badge variant="outline" className="text-amber-400 border-amber-500/30 text-[10px]">
                  CAML 2.0
                </Badge>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-white" onClick={() => onOpenChange(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <h2 className="text-lg font-bold text-amber-100 font-serif leading-tight">
                {meta.title || 'Adventure Module'}
              </h2>
              {meta.levels && (
                <p className="text-xs text-slate-400 mt-1">
                  Levels {meta.levels.min}–{meta.levels.max}
                </p>
              )}
            </div>

            <ScrollArea className="flex-1">
              <nav className="p-2 space-y-0.5">
                {tocSections.map((section) => {
                  const Icon = section.icon;
                  const isActive = activeSection === section.id;
                  return (
                    <button
                      key={section.id}
                      onClick={() => scrollToSection(section.id)}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors text-left ${
                        isActive
                          ? 'bg-amber-500/15 text-amber-300 font-medium'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                      }`}
                    >
                      <Icon className="h-4 w-4 flex-shrink-0" />
                      <span className="truncate">{section.label}</span>
                    </button>
                  );
                })}
              </nav>
            </ScrollArea>

            {onCreateCampaign && (
              <div className="p-3 border-t border-amber-900/20">
                <Button
                  onClick={onCreateCampaign}
                  className="w-full bg-amber-600 hover:bg-amber-700 text-white"
                  size="sm"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Create Campaign
                </Button>
              </div>
            )}
          </div>

          {/* Main Content */}
          <ScrollArea className="flex-1" ref={contentRef}>
            <div className="max-w-3xl mx-auto p-8 pb-16">

              {/* OVERVIEW SECTION */}
              <div ref={el => { sectionRefs.current['overview'] = el; }}>
                <div className="mb-8">
                  <div className="flex items-center gap-2 mb-1">
                    {meta.tags?.map((tag: string) => (
                      <Badge key={tag} variant="outline" className="text-[10px] text-slate-400 border-slate-600">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  <h1 className="text-4xl font-bold text-amber-100 font-serif mb-4 leading-tight">
                    {meta.title || 'Untitled Adventure'}
                  </h1>
                  {meta.authors && meta.authors.length > 0 && (
                    <p className="text-sm text-slate-500 mb-4 italic">
                      By {meta.authors.join(', ')}
                    </p>
                  )}

                  {meta.summary && (
                    <div className="bg-gradient-to-r from-amber-950/30 to-transparent border-l-2 border-amber-500/40 pl-4 py-3 mb-6">
                      <p className="text-slate-300 leading-relaxed italic text-base">
                        {meta.summary}
                      </p>
                    </div>
                  )}

                  {/* Stats bar */}
                  <div className="flex flex-wrap gap-4 text-sm text-slate-400 mb-6">
                    {meta.levels && (
                      <span className="flex items-center gap-1">
                        <Shield className="h-3.5 w-3.5 text-amber-500" />
                        Levels {meta.levels.min}–{meta.levels.max}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 text-blue-400" />
                      {locations.length} Locations
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5 text-green-400" />
                      {npcs.length} NPCs
                    </span>
                    <span className="flex items-center gap-1">
                      <Layers className="h-3.5 w-3.5 text-purple-400" />
                      {processes.length} Chapters
                    </span>
                    <span className="flex items-center gap-1">
                      <GitFork className="h-3.5 w-3.5 text-red-400" />
                      {endingSnapshots.length} Endings
                    </span>
                  </div>

                  {/* Opening Narration */}
                  {openingSnapshot?.narration && (
                    <div className="bg-slate-800/50 rounded-lg p-5 border border-slate-700/50">
                      <h3 className="text-sm font-semibold text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                        <Scroll className="h-4 w-4" />
                        Opening Scene
                      </h3>
                      <p className="text-slate-300 leading-relaxed">
                        {openingSnapshot.narration}
                      </p>
                    </div>
                  )}
                </div>

                {/* Table of Contents */}
                {toc.length > 0 && (
                  <div className="mb-8">
                    <h2 className="text-xl font-bold text-amber-200 font-serif mb-4 flex items-center gap-2">
                      <BookOpen className="h-5 w-5 text-amber-500" />
                      Table of Contents
                    </h2>
                    <div className="space-y-1">
                      {toc.map((entry: any, i: number) => (
                        <button
                          key={i}
                          onClick={() => scrollToSection('chapters')}
                          className="w-full text-left flex items-start gap-3 p-3 rounded-md hover:bg-slate-800/50 transition-colors group"
                        >
                          <span className="text-amber-500/60 font-mono text-sm w-6 flex-shrink-0 mt-0.5">
                            {String(entry.chapter || i + 1).padStart(2, '0')}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-slate-200 font-medium group-hover:text-amber-200 transition-colors">
                              {entry.title}
                            </p>
                            <p className="text-sm text-slate-500 mt-0.5 line-clamp-1">
                              {entry.summary}
                            </p>
                          </div>
                          <ChevronRight className="h-4 w-4 text-slate-600 group-hover:text-amber-500 mt-1 flex-shrink-0" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <Separator className="bg-amber-900/20 my-8" />
              </div>

              {/* DOCTRINE SECTION */}
              {doctrine.campaign_question && (
                <div ref={el => { sectionRefs.current['doctrine'] = el; }}>
                  <h2 className="text-2xl font-bold text-amber-200 font-serif mb-6 flex items-center gap-2">
                    <Target className="h-6 w-6 text-amber-500" />
                    The Central Dilemma
                  </h2>

                  <div className="bg-gradient-to-br from-red-950/20 to-amber-950/20 border border-red-900/30 rounded-lg p-6 mb-6">
                    <p className="text-lg text-amber-100 italic font-serif leading-relaxed text-center">
                      "{doctrine.campaign_question}"
                    </p>
                  </div>

                  {doctrine.stakes && doctrine.stakes.length > 0 && (
                    <div className="space-y-4 mb-6">
                      <h3 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
                        <Flame className="h-5 w-5 text-orange-400" />
                        Pressure Tracks
                      </h3>
                      {doctrine.stakes.map((stake: any, i: number) => (
                        <div key={i} className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-semibold text-slate-200">{stake.name || stake.id}</h4>
                            <div className="flex items-center gap-2">
                              {stake.drift === 'up' ? (
                                <ArrowUp className="h-4 w-4 text-red-400" />
                              ) : (
                                <ArrowDown className="h-4 w-4 text-blue-400" />
                              )}
                              <span className="text-xs text-slate-500">
                                Drift: {stake.drift} ({stake.driftRate}/scene)
                              </span>
                            </div>
                          </div>

                          {/* Pressure bar */}
                          <div className="flex gap-1 mb-3">
                            {Array.from({ length: stake.max || 5 }).map((_, j) => (
                              <div
                                key={j}
                                className={`h-2 flex-1 rounded-full ${
                                  j < (stake.value || 0)
                                    ? 'bg-gradient-to-r from-amber-500 to-red-500'
                                    : 'bg-slate-700'
                                }`}
                              />
                            ))}
                          </div>
                          <div className="flex justify-between text-xs text-slate-500">
                            <span>{stake.value || 0} / {stake.max || 5}</span>
                          </div>

                          {stake.thresholdConsequence && (
                            <div className="mt-3 grid grid-cols-2 gap-3">
                              {stake.thresholdConsequence.at0 && (
                                <div className="bg-green-950/20 border border-green-900/30 rounded p-3">
                                  <p className="text-[10px] uppercase tracking-wider text-green-400 mb-1 font-semibold">At 0 — Resolved</p>
                                  <p className="text-xs text-slate-300">{stake.thresholdConsequence.at0.event}</p>
                                  {stake.thresholdConsequence.at0.irreversible && (
                                    <Badge variant="outline" className="mt-1 text-[9px] text-red-400 border-red-500/30">Irreversible</Badge>
                                  )}
                                </div>
                              )}
                              {stake.thresholdConsequence.at5 && (
                                <div className="bg-red-950/20 border border-red-900/30 rounded p-3">
                                  <p className="text-[10px] uppercase tracking-wider text-red-400 mb-1 font-semibold">At {stake.max || 5} — Catastrophe</p>
                                  <p className="text-xs text-slate-300">{stake.thresholdConsequence.at5.event}</p>
                                  {stake.thresholdConsequence.at5.irreversible && (
                                    <Badge variant="outline" className="mt-1 text-[9px] text-red-400 border-red-500/30">Irreversible</Badge>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <Separator className="bg-amber-900/20 my-8" />
                </div>
              )}

              {/* LOCATIONS SECTION */}
              {locations.length > 0 && (
                <div ref={el => { sectionRefs.current['locations'] = el; }}>
                  <h2 className="text-2xl font-bold text-amber-200 font-serif mb-6 flex items-center gap-2">
                    <MapPin className="h-6 w-6 text-blue-400" />
                    Locations
                  </h2>
                  <div className="space-y-4 mb-6">
                    {locations.map((loc: any, i: number) => {
                      const isDiscovered = stateFacts.find((f: any) => f.bearer === loc.id && f.type === 'discovered');
                      const connectedTo = connections
                        .filter((c: any) => c.from === loc.id || c.to === loc.id)
                        .map((c: any) => {
                          const targetId = c.from === loc.id ? c.to : c.from;
                          const targetLoc = locations.find((l: any) => l.id === targetId);
                          return { name: targetLoc?.name || targetId, mode: c.mode };
                        });

                      return (
                        <div key={i} className="bg-slate-800/30 border border-slate-700/40 rounded-lg overflow-hidden">
                          <div className="p-4">
                            <div className="flex items-start justify-between mb-2">
                              <h3 className="text-lg font-semibold text-slate-100">{loc.name}</h3>
                              <div className="flex gap-1">
                                {loc.tags?.map((tag: string) => (
                                  <Badge key={tag} variant="outline" className="text-[10px] text-slate-400 border-slate-600">
                                    {tag}
                                  </Badge>
                                ))}
                                {isDiscovered?.value === false && (
                                  <Badge variant="outline" className="text-[10px] text-amber-400 border-amber-500/30">
                                    <Eye className="h-3 w-3 mr-1" />
                                    Hidden
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <p className="text-sm text-slate-400 leading-relaxed mb-3">{loc.description}</p>

                            {loc.features && loc.features.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mb-2">
                                {loc.features.map((feat: string, j: number) => (
                                  <span key={j} className="text-xs bg-slate-700/50 text-slate-300 px-2 py-0.5 rounded">
                                    {feat}
                                  </span>
                                ))}
                              </div>
                            )}

                            {connectedTo.length > 0 && (
                              <div className="flex flex-wrap gap-2 mt-2">
                                {connectedTo.map((conn: any, j: number) => (
                                  <span key={j} className="text-xs text-slate-500 flex items-center gap-1">
                                    <ChevronRight className="h-3 w-3" />
                                    {conn.name} <span className="text-slate-600">({conn.mode})</span>
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <Separator className="bg-amber-900/20 my-8" />
                </div>
              )}

              {/* CHARACTERS SECTION */}
              {npcs.length > 0 && (
                <div ref={el => { sectionRefs.current['npcs'] = el; }}>
                  <h2 className="text-2xl font-bold text-amber-200 font-serif mb-6 flex items-center gap-2">
                    <Users className="h-6 w-6 text-green-400" />
                    Characters & NPCs
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    {npcs.map((npc: any, i: number) => {
                      const attitude = getNpcAttitude(npc.id);
                      const role = roles.find((r: any) => r.holder === npc.id);

                      return (
                        <div key={i} className="bg-slate-800/30 border border-slate-700/40 rounded-lg p-4">
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center text-slate-300 font-bold text-sm flex-shrink-0">
                              {(npc.name || '?')[0]}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-semibold text-slate-100 truncate">{npc.name}</h3>
                                <span className={`text-xs ${attitudeColor(attitude)}`}>
                                  {attitude}
                                </span>
                              </div>
                              <p className="text-xs text-slate-500 mb-2">
                                {[npc.species, npc.class].filter(Boolean).join(' ')}
                              </p>
                              <p className="text-sm text-slate-400 line-clamp-3">{npc.description}</p>
                              {role && (
                                <div className="mt-2">
                                  <Badge variant="outline" className="text-[10px] text-amber-400 border-amber-500/30">
                                    <Crown className="h-3 w-3 mr-1" />
                                    {role.role}
                                  </Badge>
                                  {role.notes && (
                                    <p className="text-xs text-slate-500 mt-1 italic">{role.notes}</p>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <Separator className="bg-amber-900/20 my-8" />
                </div>
              )}

              {/* ITEMS SECTION */}
              {items.length > 0 && (
                <div ref={el => { sectionRefs.current['items'] = el; }}>
                  <h2 className="text-2xl font-bold text-amber-200 font-serif mb-6 flex items-center gap-2">
                    <Package className="h-6 w-6 text-orange-400" />
                    Items & Treasures
                  </h2>
                  <div className="space-y-3 mb-6">
                    {items.map((item: any, i: number) => (
                      <div key={i} className="bg-slate-800/30 border border-slate-700/40 rounded-lg p-4">
                        <div className="flex items-start justify-between mb-2">
                          <h3 className={`font-semibold ${rarityColors[item.rarity?.toLowerCase()] || 'text-slate-100'}`}>
                            {item.name}
                          </h3>
                          <Badge variant="outline" className={`text-[10px] ${rarityColors[item.rarity?.toLowerCase()] || 'text-slate-400'} border-current/30`}>
                            {item.rarity}
                          </Badge>
                        </div>
                        <p className="text-sm text-slate-400 mb-2">{item.description}</p>
                        {item.consequence && (
                          <div className="flex items-start gap-2 bg-red-950/15 border border-red-900/25 rounded p-2.5 mt-2">
                            <AlertTriangle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
                            <p className="text-xs text-red-300/80">{item.consequence}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <Separator className="bg-amber-900/20 my-8" />
                </div>
              )}

              {/* CHAPTERS/PROCESSES SECTION */}
              {processes.length > 0 && (
                <div ref={el => { sectionRefs.current['chapters'] = el; }}>
                  <h2 className="text-2xl font-bold text-amber-200 font-serif mb-6 flex items-center gap-2">
                    <Layers className="h-6 w-6 text-purple-400" />
                    Chapters & Encounters
                  </h2>
                  <div className="space-y-4 mb-6">
                    {processes.map((proc: any, i: number) => {
                      const Icon = processTypeIcons[proc.type] || Sword;
                      const colorClass = processTypeColors[proc.type] || processTypeColors.combat;
                      const tocEntry = toc[i];
                      const transition = transitions.find((t: any) => t.caused_by === proc.id);
                      const participantNames = (proc.participants || [])
                        .map((pid: string) => {
                          if (pid === 'PC_Party') return 'The Party';
                          const npc = npcs.find((n: any) => n.id === pid);
                          return npc?.name || pid;
                        });
                      const locationName = locations.find((l: any) => l.id === proc.location)?.name || proc.location;

                      return (
                        <div key={i} className="bg-slate-800/30 border border-slate-700/40 rounded-lg overflow-hidden">
                          <div className={`px-4 py-2 border-b border-slate-700/30 flex items-center gap-3 ${colorClass}`}>
                            <span className="text-sm font-mono opacity-60">{String(i + 1).padStart(2, '0')}</span>
                            <Icon className="h-4 w-4" />
                            <span className="text-sm font-semibold capitalize">{proc.type}</span>
                            {proc.timebox?.label && (
                              <span className="text-xs opacity-60 ml-auto flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {proc.timebox.label}
                              </span>
                            )}
                          </div>
                          <div className="p-4">
                            {tocEntry && (
                              <h3 className="text-lg font-semibold text-slate-100 mb-1">{tocEntry.title}</h3>
                            )}
                            <p className="text-sm text-slate-400 leading-relaxed mb-3">{proc.notes || tocEntry?.summary}</p>

                            <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                              {locationName && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3 text-blue-400" />
                                  {locationName}
                                </span>
                              )}
                              {participantNames.length > 0 && (
                                <span className="flex items-center gap-1">
                                  <Users className="h-3 w-3 text-green-400" />
                                  {participantNames.join(', ')}
                                </span>
                              )}
                            </div>

                            {proc.stake_effects && proc.stake_effects.length > 0 && (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {proc.stake_effects.map((effect: any, j: number) => {
                                  const stake = doctrine.stakes?.find((s: any) => s.id === effect.stake_id);
                                  return (
                                    <div key={j} className="flex items-center gap-1.5 bg-slate-700/30 rounded px-2 py-1">
                                      {effect.delta > 0 ? (
                                        <ArrowUp className="h-3 w-3 text-red-400" />
                                      ) : (
                                        <ArrowDown className="h-3 w-3 text-green-400" />
                                      )}
                                      <span className="text-xs text-slate-300">{stake?.name || effect.stake_id}</span>
                                      <span className="text-[10px] text-slate-500">
                                        ({effect.delta > 0 ? '+' : ''}{effect.delta})
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {transition && (
                              <div className="mt-3 bg-slate-700/20 rounded p-2.5 border border-slate-700/30">
                                <p className="text-[10px] uppercase tracking-wider text-amber-400 mb-1 font-semibold">Outcome</p>
                                <div className="flex flex-wrap gap-1.5">
                                  {transition.ops?.map((op: any, k: number) => (
                                    <span key={k} className="text-xs text-slate-400">
                                      {op.state_id}: {String(op.value)}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <Separator className="bg-amber-900/20 my-8" />
                </div>
              )}

              {/* ENDINGS SECTION */}
              {endingSnapshots.length > 0 && (
                <div ref={el => { sectionRefs.current['endings'] = el; }}>
                  <h2 className="text-2xl font-bold text-amber-200 font-serif mb-6 flex items-center gap-2">
                    <GitFork className="h-6 w-6 text-red-400" />
                    Forked Endings
                  </h2>
                  <div className="space-y-4 mb-6">
                    {endingSnapshots.map((snap: any, i: number) => (
                      <div key={i} className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 border border-slate-700/40 rounded-lg p-5">
                        <div className="flex items-center gap-2 mb-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                            i === 0 ? 'bg-amber-500/20 text-amber-400' : 'bg-purple-500/20 text-purple-400'
                          }`}>
                            {String.fromCharCode(65 + i)}
                          </div>
                          <h3 className="font-semibold text-slate-100">
                            Ending {String.fromCharCode(65 + i)}
                          </h3>
                        </div>
                        <p className="text-sm text-slate-300 leading-relaxed italic">
                          {snap.narration}
                        </p>
                      </div>
                    ))}
                  </div>
                  <Separator className="bg-amber-900/20 my-8" />
                </div>
              )}

              {/* CONNECTIONS MAP */}
              {connections.length > 0 && (
                <div ref={el => { sectionRefs.current['map'] = el; }}>
                  <h2 className="text-2xl font-bold text-amber-200 font-serif mb-6 flex items-center gap-2">
                    <Compass className="h-6 w-6 text-emerald-400" />
                    Location Connections
                  </h2>
                  <div className="bg-slate-800/30 border border-slate-700/40 rounded-lg p-4">
                    <div className="space-y-2">
                      {connections.map((conn: any, i: number) => {
                        const fromLoc = locations.find((l: any) => l.id === conn.from);
                        const toLoc = locations.find((l: any) => l.id === conn.to);
                        return (
                          <div key={i} className="flex items-center gap-2 text-sm">
                            <span className="text-slate-300">{fromLoc?.name || conn.from}</span>
                            <span className="text-slate-600 flex items-center gap-1 px-2">
                              <ChevronRight className="h-3 w-3" />
                              <span className="text-xs">{conn.mode}</span>
                              <ChevronRight className="h-3 w-3" />
                            </span>
                            <span className="text-slate-300">{toLoc?.name || conn.to}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Footer */}
              <div className="mt-12 text-center">
                <Separator className="bg-amber-900/20 mb-6" />
                <p className="text-xs text-slate-600">
                  CAML {camlData.caml_version || '2.0'} Adventure Module
                  {meta.created_utc && ` — Created ${new Date(meta.created_utc).toLocaleDateString()}`}
                </p>
              </div>
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}