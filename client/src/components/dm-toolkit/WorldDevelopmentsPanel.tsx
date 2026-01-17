import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { Globe, AlertTriangle, TrendingUp, Clock, Check, X, Pause, Edit2, Scroll, Sparkles } from "lucide-react";

interface WorldDevelopment {
  id: number;
  title: string;
  narrative: string;
  consequence?: string;
  developmentType: string;
  urgency: string;
  triggeredBy?: string;
  dmDecision?: string;
  dmNotes?: string;
  createdAt: string;
}

interface WorldState {
  message: string;
  tensions: string[];
}

export default function WorldDevelopmentsPanel({ campaignId }: { campaignId?: number }) {
  const { toast } = useToast();
  const [selectedDevelopment, setSelectedDevelopment] = useState<WorldDevelopment | null>(null);
  const [dmNotes, setDmNotes] = useState("");
  
  const { data: developments = [], isLoading } = useQuery<WorldDevelopment[]>({
    queryKey: ["/api/world/developments", campaignId],
    queryFn: async () => {
      const url = campaignId 
        ? `/api/world/developments?campaignId=${campaignId}` 
        : '/api/world/developments';
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch');
      return response.json();
    }
  });
  
  const { data: worldState } = useQuery<WorldState>({
    queryKey: ["/api/world/state"],
  });
  
  const decideMutation = useMutation({
    mutationFn: async ({ id, decision, notes }: { id: number; decision: string; notes?: string }) => {
      const response = await apiRequest("POST", `/api/world/developments/${id}/decide`, { decision, notes });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/world/developments"] });
      toast({ title: "Decision recorded", description: "The world takes note." });
      setSelectedDevelopment(null);
      setDmNotes("");
    }
  });
  
  const getUrgencyBadge = (urgency: string) => {
    switch (urgency) {
      case 'pressing': return 'bg-amber-500/20 text-amber-200 border-amber-500/40';
      case 'moderate': return 'bg-purple-500/20 text-purple-200 border-purple-500/40';
      default: return 'bg-stone-500/20 text-stone-300 border-stone-500/40';
    }
  };
  
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'threat': return <AlertTriangle className="h-5 w-5 text-red-400" />;
      case 'opportunity': return <TrendingUp className="h-5 w-5 text-emerald-400" />;
      case 'consequence': return <Clock className="h-5 w-5 text-amber-400" />;
      default: return <Globe className="h-5 w-5 text-purple-400" />;
    }
  };
  
  if (isLoading) {
    return (
      <Card className="rounded-xl bg-gradient-to-br from-purple-900/80 to-purple-800/60 border-2 border-amber-600/30">
        <CardContent className="p-8 text-center text-purple-200">
          <Sparkles className="h-8 w-8 mx-auto mb-3 animate-pulse text-amber-400" />
          Loading world state...
        </CardContent>
      </Card>
    );
  }
  
  return (
    <div className="space-y-6">
      {worldState && (
        <div className="rounded-xl bg-gradient-to-r from-amber-900/40 via-orange-900/30 to-amber-900/40 border-2 border-amber-600/40 p-4">
          <p className="text-amber-100 italic text-center font-serif text-lg">
            "{worldState.message}"
          </p>
        </div>
      )}
      
      <Card className="rounded-xl overflow-hidden border-2 border-amber-600/30 bg-[#f4e4c1]">
        <CardHeader className="bg-gradient-to-r from-purple-700 to-purple-600 pb-4">
          <CardTitle className="flex items-center gap-3 text-white font-serif text-xl">
            <Globe className="h-6 w-6" />
            Possible World Developments
          </CardTitle>
          <CardDescription className="text-purple-100">
            The world may be changing... You decide what matters.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 bg-gradient-to-b from-[#f4e4c1] to-[#e8d4a8]">
          {developments.length === 0 ? (
            <div className="text-center py-10">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-purple-100 mb-4">
                <Scroll className="h-8 w-8 text-purple-600" />
              </div>
              <p className="text-stone-700 font-serif text-lg">The world rests quietly... for now.</p>
              <p className="text-stone-500 text-sm mt-2">Developments will appear as players act or ignore events.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {developments.map(dev => (
                <div 
                  key={dev.id}
                  className="rounded-xl overflow-hidden border-2 border-amber-700/30 bg-gradient-to-br from-purple-800 to-purple-700 shadow-lg"
                >
                  <div className="p-5">
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-purple-600/50 flex items-center justify-center">
                        {getTypeIcon(dev.developmentType)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                          <h4 className="font-serif font-bold text-white text-lg">{dev.title}</h4>
                          <Badge variant="outline" className={`${getUrgencyBadge(dev.urgency)} text-xs`}>
                            {dev.urgency}
                          </Badge>
                        </div>
                        <p className="text-purple-100 mb-3">{dev.narrative}</p>
                        {dev.consequence && (
                          <p className="text-amber-300/90 text-sm italic border-l-2 border-amber-500/50 pl-3">
                            If ignored: {dev.consequence}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-2 p-4 bg-black/20 border-t border-amber-600/20">
                    <Button 
                      size="sm" 
                      className="bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-500/50"
                      onClick={() => decideMutation.mutate({ id: dev.id, decision: 'adopted' })}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Adopt
                    </Button>
                    <Button 
                      size="sm"
                      className="bg-purple-600 hover:bg-purple-700 text-white border border-purple-500/50"
                      onClick={() => {
                        setSelectedDevelopment(dev);
                        setDmNotes("");
                      }}
                    >
                      <Edit2 className="h-4 w-4 mr-1" />
                      Modify
                    </Button>
                    <Button 
                      size="sm"
                      className="bg-amber-600 hover:bg-amber-700 text-white border border-amber-500/50"
                      onClick={() => decideMutation.mutate({ id: dev.id, decision: 'postponed' })}
                    >
                      <Pause className="h-4 w-4 mr-1" />
                      Later
                    </Button>
                    <Button 
                      size="sm"
                      variant="outline"
                      className="border-stone-500/50 text-stone-300 hover:bg-stone-700/30"
                      onClick={() => decideMutation.mutate({ id: dev.id, decision: 'ignored' })}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Ignore
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {selectedDevelopment && (
            <div className="mt-6 rounded-xl overflow-hidden border-2 border-purple-500/40 bg-gradient-to-br from-purple-800 to-purple-900">
              <div className="p-4 bg-purple-700/50 border-b border-purple-500/30">
                <h4 className="font-serif font-bold text-white flex items-center gap-2">
                  <Edit2 className="h-4 w-4" />
                  Modify: {selectedDevelopment.title}
                </h4>
              </div>
              <div className="p-4">
                <Textarea 
                  placeholder="Add your notes about how this will play out..."
                  value={dmNotes}
                  onChange={(e) => setDmNotes(e.target.value)}
                  className="bg-purple-950/50 border-purple-600/40 text-purple-100 placeholder:text-purple-400/50 mb-4 min-h-[100px]"
                />
                <div className="flex gap-3">
                  <Button 
                    onClick={() => decideMutation.mutate({ 
                      id: selectedDevelopment.id, 
                      decision: 'modified', 
                      notes: dmNotes 
                    })}
                    className="bg-amber-600 hover:bg-amber-700 text-white"
                  >
                    Save Modified Version
                  </Button>
                  <Button 
                    variant="outline"
                    className="border-purple-500/50 text-purple-200 hover:bg-purple-700/30"
                    onClick={() => setSelectedDevelopment(null)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
