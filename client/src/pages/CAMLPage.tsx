import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { CAMLManager } from '@/components/caml/CAMLManager';
import { Button } from '@/components/ui/button';
import { ArrowLeft, FileCode, Share2, Sparkles } from 'lucide-react';

export default function CAMLPage() {
  const [, setLocation] = useLocation();
  
  const { data: campaigns } = useQuery<Array<{ id: number }>>({
    queryKey: ['/api/campaigns']
  });
  
  const handleImportComplete = (campaignId: number) => {
    setLocation(`/campaign/${campaignId}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Hero Section */}
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
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <div className="flex items-center gap-3 mb-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-sm">
              <FileCode className="h-3 w-3" />
              <span>Share & Import Adventures</span>
            </div>
          </div>
          <h1 className="text-2xl md:text-3xl font-fantasy font-bold text-white mb-2">CAML 2.0 Adventure Manager</h1>
          <p className="text-white/60">Import, export, and share structured adventures</p>
        </div>
      </section>
      
      <div className="container mx-auto p-6 max-w-4xl">
      <p className="text-muted-foreground mb-6">
        Import structured adventures from CAML 2.0 files, export your campaigns for sharing, 
        or generate new adventures using AI. CAML 2.0 (Canonical Adventure Markup Language) 
        uses ontological layers to separate world, state, roles, processes, and transitions
        for full traceability and replay support.
      </p>
      
      <CAMLManager 
        campaignId={campaigns?.[0]?.id} 
        onImportComplete={handleImportComplete}
      />
      
      <div className="mt-8 p-4 bg-muted/50 rounded-lg">
        <h2 className="font-semibold mb-2" style={{ color: '#0f172a' }}>About CAML 2.0</h2>
        <p className="text-sm text-muted-foreground">
          CAML 2.0 separates adventure data into ontological layers: world (entities), 
          state (facts), roles (assignments), processes (occurrents), transitions (changes), 
          and snapshots (timeline). This enables full audit, replay, and correspondence play.
          Both CAML 1.x and 2.0 formats are supported for import.
        </p>
        <a 
          href="https://github.com/dkoepsell/CAML5e" 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-sm text-primary hover:underline mt-2 inline-block"
        >
          Learn more about CAML-5e on GitHub
        </a>
      </div>
      </div>
    </div>
  );
}
