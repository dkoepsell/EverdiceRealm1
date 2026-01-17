import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { Globe, AlertTriangle, TrendingUp, Eye, Clock, Check, X, Pause, Edit2 } from "lucide-react";

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
  
  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'pressing': return 'text-amber-500 bg-amber-500/10';
      case 'moderate': return 'text-yellow-500 bg-yellow-500/10';
      default: return 'text-slate-400 bg-slate-400/10';
    }
  };
  
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'threat': return <AlertTriangle className="h-4 w-4 text-red-400" />;
      case 'opportunity': return <TrendingUp className="h-4 w-4 text-green-400" />;
      case 'consequence': return <Clock className="h-4 w-4 text-amber-400" />;
      default: return <Globe className="h-4 w-4 text-blue-400" />;
    }
  };
  
  if (isLoading) {
    return (
      <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-amber-900/30">
        <CardContent className="p-6 text-center text-slate-400">
          Loading world state...
        </CardContent>
      </Card>
    );
  }
  
  return (
    <div className="space-y-4">
      {worldState && (
        <Card className="bg-gradient-to-r from-amber-900/20 to-orange-900/10 border-amber-700/30">
          <CardContent className="p-4">
            <p className="text-amber-200/80 italic text-sm text-center">
              {worldState.message}
            </p>
          </CardContent>
        </Card>
      )}
      
      <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-amber-900/30">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-amber-100">
            <Globe className="h-5 w-5" />
            Possible World Developments
          </CardTitle>
          <CardDescription className="text-slate-400">
            The world may be changing... You decide what matters.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {developments.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <Globe className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>The world rests quietly... for now.</p>
              <p className="text-xs mt-2">Developments will appear as players act or ignore events.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {developments.map(dev => (
                <div 
                  key={dev.id}
                  className="p-4 rounded-lg bg-black/30 border border-amber-900/20 hover:border-amber-700/40 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1">
                      {getTypeIcon(dev.developmentType)}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-amber-100">{dev.title}</h4>
                          <Badge variant="outline" className={getUrgencyColor(dev.urgency)}>
                            {dev.urgency}
                          </Badge>
                        </div>
                        <p className="text-sm text-slate-300 mb-2">{dev.narrative}</p>
                        {dev.consequence && (
                          <p className="text-xs text-amber-400/70 italic">
                            If ignored: {dev.consequence}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-2 mt-3 pt-3 border-t border-amber-900/20">
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="text-green-400 hover:text-green-300 hover:bg-green-900/20"
                      onClick={() => decideMutation.mutate({ id: dev.id, decision: 'adopted' })}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Adopt
                    </Button>
                    <Button 
                      size="sm" 
                      variant="ghost"
                      className="text-blue-400 hover:text-blue-300 hover:bg-blue-900/20"
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
                      variant="ghost"
                      className="text-amber-400 hover:text-amber-300 hover:bg-amber-900/20"
                      onClick={() => decideMutation.mutate({ id: dev.id, decision: 'postponed' })}
                    >
                      <Pause className="h-4 w-4 mr-1" />
                      Later
                    </Button>
                    <Button 
                      size="sm" 
                      variant="ghost"
                      className="text-slate-400 hover:text-slate-300 hover:bg-slate-900/20"
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
            <div className="mt-4 p-4 rounded-lg bg-blue-900/20 border border-blue-700/30">
              <h4 className="font-medium text-blue-200 mb-2">Modify: {selectedDevelopment.title}</h4>
              <Textarea 
                placeholder="Add your notes about how this will play out..."
                value={dmNotes}
                onChange={(e) => setDmNotes(e.target.value)}
                className="bg-black/30 border-blue-900/40 text-slate-200 mb-3"
              />
              <div className="flex gap-2">
                <Button 
                  size="sm"
                  onClick={() => decideMutation.mutate({ 
                    id: selectedDevelopment.id, 
                    decision: 'modified', 
                    notes: dmNotes 
                  })}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Save Modified Version
                </Button>
                <Button 
                  size="sm" 
                  variant="ghost"
                  onClick={() => setSelectedDevelopment(null)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
