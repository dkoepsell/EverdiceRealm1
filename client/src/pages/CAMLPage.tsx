import { useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { CAMLManager } from '@/components/caml/CAMLManager';
import { AdventureModuleReader } from '@/components/adventure/AdventureModuleReader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  ArrowLeft, 
  FileCode, 
  Share2, 
  Sparkles, 
  BookOpen, 
  MapPin, 
  Users, 
  Layers, 
  Trash2, 
  Loader2,
  Library,
  GitFork,
  Target,
  Sword
} from 'lucide-react';

export default function CAMLPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [readerOpen, setReaderOpen] = useState(false);
  const [selectedAdventure, setSelectedAdventure] = useState<any>(null);
  
  const { data: campaigns } = useQuery<Array<{ id: number }>>({
    queryKey: ['/api/campaigns']
  });

  const { data: myAdventures, isLoading: adventuresLoading } = useQuery<any[]>({
    queryKey: ['/api/adventures/my']
  });
  
  const handleImportComplete = (campaignId: number) => {
    setLocation(`/campaign/${campaignId}`);
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/adventures/${id}`);
    },
    onSuccess: () => {
      toast({ title: 'Adventure Deleted' });
      queryClient.invalidateQueries({ queryKey: ['/api/adventures/my'] });
    },
  });

  const createFromLibraryMutation = useMutation({
    mutationFn: async (camlData: any) => {
      const response = await apiRequest('POST', '/api/caml/import', {
        content: JSON.stringify(camlData),
        format: 'json',
        createCampaign: true,
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({ title: 'Campaign Created!', description: 'Adventure imported as a new campaign.' });
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns'] });
      if (data.campaignId) {
        setReaderOpen(false);
        setLocation(`/campaign/${data.campaignId}`);
      }
    },
    onError: (error: any) => {
      toast({ title: 'Failed', description: error.message, variant: 'destructive' });
    },
  });

  const openAdventureReader = (adventure: any) => {
    setSelectedAdventure(adventure.camlData);
    setReaderOpen(true);
  };

  const getAdventureStats = (caml: any) => {
    if (!caml) return { locations: 0, npcs: 0, chapters: 0, endings: 0 };
    const locations = caml.world?.entities?.locations?.length || 0;
    const npcs = (caml.world?.entities?.characters || []).filter((c: any) => !c.pc).length;
    const chapters = caml.processes?.catalog?.length || 0;
    const endings = (caml.snapshots?.timeline || []).filter((s: any) => s.id?.includes('Ending') || s.derived_from_transition).length;
    return { locations, npcs, chapters, endings };
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <section className="relative bg-gradient-to-br from-slate-900 via-indigo-900/20 to-slate-900 py-8 md:py-12 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 via-violet-500/5 to-transparent"></div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl"></div>
        <div className="absolute top-6 right-8 md:right-16 opacity-15">
          <FileCode className="h-14 w-14 md:h-20 md:w-20 text-indigo-400" />
        </div>
        <div className="absolute top-16 right-20 md:right-40 opacity-10">
          <Share2 className="h-10 w-10 md:h-16 md:w-16 text-violet-300" />
        </div>
        <div className="absolute bottom-6 right-12 md:right-28 opacity-10">
          <Sparkles className="h-12 w-12 md:h-16 md:w-16 text-indigo-300" />
        </div>
        <div className="container mx-auto px-4 relative z-10">
          <Button
            variant="ghost"
            onClick={() => setLocation('/')}
            className="mb-4 text-white/70 hover:text-white hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <div className="flex items-center gap-3 mb-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-sm">
              <FileCode className="h-3 w-3" />
              <span>Adventure Modules</span>
            </div>
          </div>
          <h1 className="text-2xl md:text-3xl font-fantasy font-bold text-white mb-2">CAML 2.0 Adventure Manager</h1>
          <p className="text-white/60">Generate, browse, and study adventure modules before running them</p>
        </div>
      </section>
      
      <div className="container mx-auto p-6 max-w-5xl">

        {/* MY ADVENTURE LIBRARY */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Library className="h-6 w-6 text-amber-500" />
            <h2 className="text-xl font-bold text-foreground">My Adventure Library</h2>
            <Badge variant="outline" className="text-xs">
              {myAdventures?.length || 0} modules
            </Badge>
          </div>

          {adventuresLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !myAdventures || myAdventures.length === 0 ? (
            <Card className="bg-slate-900/50 border-slate-800">
              <CardContent className="py-12 text-center">
                <BookOpen className="h-12 w-12 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400 mb-2">Your adventure library is empty</p>
                <p className="text-sm text-slate-500">
                  Generate an adventure below and save it to your library to study its structure
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {myAdventures.map((adventure: any) => {
                const caml = adventure.camlData;
                const stats = getAdventureStats(caml);
                const doctrine = caml?.doctrine;
                
                return (
                  <Card 
                    key={adventure.id} 
                    className="bg-gradient-to-br from-slate-900 to-slate-950 border-slate-800 hover:border-amber-900/40 transition-all group cursor-pointer overflow-hidden"
                    onClick={() => openAdventureReader(adventure)}
                  >
                    {/* Decorative top band */}
                    <div className="h-1.5 bg-gradient-to-r from-amber-600 via-orange-500 to-red-600" />
                    
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-amber-100 font-serif truncate group-hover:text-amber-300 transition-colors">
                            {adventure.title}
                          </h3>
                          {caml?.meta?.levels && (
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              Levels {caml.meta.levels.min}–{caml.meta.levels.max}
                            </p>
                          )}
                        </div>
                        <Badge variant="outline" className="text-[9px] text-amber-400/60 border-amber-500/20 flex-shrink-0 ml-2">
                          CAML 2.0
                        </Badge>
                      </div>

                      {/* Summary */}
                      {(caml?.meta?.summary || adventure.description) && (
                        <p className="text-xs text-slate-400 line-clamp-2 mb-3 leading-relaxed">
                          {caml?.meta?.summary || adventure.description}
                        </p>
                      )}

                      {/* Campaign Question */}
                      {doctrine?.campaign_question && (
                        <div className="bg-red-950/15 border border-red-900/20 rounded px-2.5 py-1.5 mb-3">
                          <p className="text-[10px] text-red-400/80 italic line-clamp-2 flex items-start gap-1.5">
                            <Target className="h-3 w-3 flex-shrink-0 mt-0.5" />
                            {doctrine.campaign_question}
                          </p>
                        </div>
                      )}

                      {/* Stats */}
                      <div className="flex flex-wrap gap-3 text-[11px] text-slate-500 mb-3">
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-blue-400/60" />
                          {stats.locations}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3 text-green-400/60" />
                          {stats.npcs}
                        </span>
                        <span className="flex items-center gap-1">
                          <Layers className="h-3 w-3 text-purple-400/60" />
                          {stats.chapters}
                        </span>
                        <span className="flex items-center gap-1">
                          <GitFork className="h-3 w-3 text-red-400/60" />
                          {stats.endings}
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="flex-1 bg-amber-600/80 hover:bg-amber-600 text-xs h-8"
                          onClick={(e) => { e.stopPropagation(); openAdventureReader(adventure); }}
                        >
                          <BookOpen className="h-3 w-3 mr-1.5" />
                          Read
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 text-xs h-8 border-slate-700 hover:border-amber-700"
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            if (caml) createFromLibraryMutation.mutate(caml);
                          }}
                          disabled={createFromLibraryMutation.isPending}
                        >
                          {createFromLibraryMutation.isPending ? (
                            <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                          ) : (
                            <Sword className="h-3 w-3 mr-1.5" />
                          )}
                          Play
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-slate-600 hover:text-red-400"
                          onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(adventure.id); }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>

                      {/* Date */}
                      <p className="text-[10px] text-slate-600 mt-2">
                        {new Date(adventure.createdAt).toLocaleDateString()}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* CAML Manager (Generate/Import/Export) */}
        <CAMLManager 
          campaignId={campaigns?.[0]?.id} 
          onImportComplete={handleImportComplete}
        />
        
        <div className="mt-8 p-4 bg-card/80 border border-border rounded-lg">
          <h2 className="font-semibold mb-2 text-foreground">About CAML 2.0</h2>
          <p className="text-sm text-foreground/80 leading-relaxed">
            CAML 2.0 separates adventure data into ontological layers: world (entities), 
            state (facts), roles (assignments), processes (occurrents), transitions (changes), 
            and snapshots (timeline). This enables full audit, replay, and correspondence play.
            Both CAML 1.x and 2.0 formats are supported for import.
          </p>
          <a 
            href="https://github.com/dkoepsell/CAML5e" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-sm text-amber-500 hover:text-amber-400 hover:underline mt-3 inline-block font-medium"
          >
            Learn more about CAML-5e on GitHub →
          </a>
        </div>
      </div>

      <AdventureModuleReader
        open={readerOpen}
        onOpenChange={setReaderOpen}
        camlData={selectedAdventure}
        onCreateCampaign={selectedAdventure ? () => {
          createFromLibraryMutation.mutate(selectedAdventure);
        } : undefined}
      />
    </div>
  );
}
