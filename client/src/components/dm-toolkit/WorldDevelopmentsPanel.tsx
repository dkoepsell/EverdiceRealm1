import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { Globe, AlertTriangle, TrendingUp, Clock, Check, X, Pause, Edit2, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

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
      case 'pressing': return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30';
      case 'moderate': return 'bg-primary/10 text-primary border-primary/30';
      default: return 'bg-muted text-muted-foreground border-border';
    }
  };
  
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'threat': return <AlertTriangle className="h-5 w-5 text-red-500" />;
      case 'opportunity': return <TrendingUp className="h-5 w-5 text-emerald-500" />;
      case 'consequence': return <Clock className="h-5 w-5 text-amber-500" />;
      default: return <Globe className="h-5 w-5 text-primary" />;
    }
  };
  
  if (isLoading) {
    return (
      <Card className="border-primary/20 bg-card/50 backdrop-blur">
        <CardContent className="p-8 text-center">
          <Sparkles className="h-8 w-8 mx-auto mb-3 animate-pulse text-primary" />
          <p className="text-muted-foreground">Loading world state...</p>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <div className="space-y-6">
      {worldState && (
        <motion.div 
          className="rounded-2xl bg-gradient-to-r from-primary/10 to-amber-500/10 border border-primary/20 p-6"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <p className="text-center text-lg italic text-muted-foreground">
            "{worldState.message}"
          </p>
        </motion.div>
      )}
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="border-primary/20 bg-card/50 backdrop-blur overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-primary/5 to-amber-500/5 border-b border-primary/10">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Globe className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-xl">World Developments</CardTitle>
                <CardDescription>
                  The world may be changing... You decide what matters.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {developments.length === 0 ? (
              <div className="text-center py-12">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Globe className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">The world rests quietly</h3>
                <p className="text-muted-foreground text-sm max-w-md mx-auto">
                  Developments will appear as players act or ignore events in your campaign.
                </p>
              </div>
            ) : (
              <div className="grid gap-4">
                {developments.map((dev, index) => (
                  <motion.div 
                    key={dev.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="rounded-xl border border-border hover:border-primary/30 transition-all duration-300 overflow-hidden bg-card"
                  >
                    <div className="p-5">
                      <div className="flex items-start gap-4">
                        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          {getTypeIcon(dev.developmentType)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2 flex-wrap">
                            <h4 className="font-semibold text-lg">{dev.title}</h4>
                            <Badge variant="outline" className={getUrgencyBadge(dev.urgency)}>
                              {dev.urgency}
                            </Badge>
                          </div>
                          <p className="text-muted-foreground mb-3">{dev.narrative}</p>
                          {dev.consequence && (
                            <p className="text-sm text-amber-600 dark:text-amber-400 italic border-l-2 border-amber-500/50 pl-3">
                              If ignored: {dev.consequence}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap gap-2 p-4 bg-muted/30 border-t border-border">
                      <Button 
                        size="sm" 
                        className="bg-emerald-500 hover:bg-emerald-600 text-white"
                        onClick={() => decideMutation.mutate({ id: dev.id, decision: 'adopted' })}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Adopt
                      </Button>
                      <Button 
                        size="sm"
                        variant="outline"
                        className="border-primary/30 hover:bg-primary/10"
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
                        variant="outline"
                        className="border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
                        onClick={() => decideMutation.mutate({ id: dev.id, decision: 'postponed' })}
                      >
                        <Pause className="h-4 w-4 mr-1" />
                        Later
                      </Button>
                      <Button 
                        size="sm"
                        variant="ghost"
                        className="text-muted-foreground hover:text-foreground"
                        onClick={() => decideMutation.mutate({ id: dev.id, decision: 'ignored' })}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Ignore
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
            
            {selectedDevelopment && (
              <motion.div 
                className="mt-6 rounded-xl border border-primary/30 bg-gradient-to-br from-primary/5 to-transparent overflow-hidden"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <div className="p-4 bg-primary/5 border-b border-primary/20">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Edit2 className="h-4 w-4 text-primary" />
                    Modify: {selectedDevelopment.title}
                  </h4>
                </div>
                <div className="p-4">
                  <Textarea 
                    placeholder="Add your notes about how this will play out..."
                    value={dmNotes}
                    onChange={(e) => setDmNotes(e.target.value)}
                    className="mb-4 min-h-[100px] bg-background"
                  />
                  <div className="flex gap-3">
                    <Button 
                      onClick={() => decideMutation.mutate({ 
                        id: selectedDevelopment.id, 
                        decision: 'modified', 
                        notes: dmNotes 
                      })}
                      className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
                    >
                      Save Modified Version
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => setSelectedDevelopment(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
