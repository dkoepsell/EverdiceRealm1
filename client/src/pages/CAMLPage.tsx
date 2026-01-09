import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { CAMLManager } from '@/components/caml/CAMLManager';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function CAMLPage() {
  const [, setLocation] = useLocation();
  
  const { data: campaigns } = useQuery<Array<{ id: number }>>({
    queryKey: ['/api/campaigns']
  });
  
  const handleImportComplete = (campaignId: number) => {
    setLocation(`/campaign/${campaignId}`);
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <Button
        variant="ghost"
        onClick={() => setLocation('/')}
        className="mb-4"
        data-testid="button-back"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Dashboard
      </Button>
      
      <h1 className="text-3xl font-bold mb-6" style={{ color: '#0f172a' }}>
        CAML 2.0 Adventure Manager
      </h1>
      
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
  );
}
