import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  ChevronDown, 
  ChevronUp, 
  Shield, 
  Zap, 
  Target, 
  AlertTriangle,
  HelpCircle,
  Lightbulb,
  Clock,
  CheckCircle,
  XCircle,
  Timer,
  Sparkles,
  Plus,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import {
  ThreatArchetype,
  BEGINNER_THREAT_PACK,
  THREAT_TIER_INFO,
  PLAYSTYLE_ROLE_INFO
} from '@/lib/threat-archetypes';

interface ThreatCardProps {
  archetype: ThreatArchetype;
  isExpanded: boolean;
  onToggle: () => void;
  onGenerate: (archetype: ThreatArchetype) => void;
  onCreate: (archetype: ThreatArchetype) => void;
  isGenerating: boolean;
}

function ThreatCard({ archetype, isExpanded, onToggle, onGenerate, onCreate, isGenerating }: ThreatCardProps) {
  const tierInfo = THREAT_TIER_INFO[archetype.threatTier];
  const roleInfo = PLAYSTYLE_ROLE_INFO[archetype.playstyleRole];

  return (
    <Card className={`transition-all duration-200 ${isExpanded ? 'ring-2 ring-amber-500/50' : 'hover:border-amber-500/30'}`}>
      <Collapsible open={isExpanded} onOpenChange={onToggle}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">{roleInfo.icon}</span>
                  <CardTitle className="text-lg">{archetype.displayName}</CardTitle>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className={tierInfo.color}>
                    {tierInfo.label} Threat
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    {roleInfo.label}
                  </Badge>
                </div>
                <CardDescription className="mt-2 text-sm">
                  {archetype.narrativeFunction.purpose}
                </CardDescription>
              </div>
              <div className="flex items-center gap-1 ml-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-8"
                  onClick={(e) => { e.stopPropagation(); onCreate(archetype); }}
                >
                  <Plus className="h-3 w-3 mr-1" /> Create
                </Button>
                <Button 
                  size="sm" 
                  className="h-8"
                  onClick={(e) => { e.stopPropagation(); onGenerate(archetype); }}
                  disabled={isGenerating}
                >
                  {isGenerating ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1" />}
                  Generate
                </Button>
                <Button variant="ghost" size="sm">
                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="pt-0 space-y-6">
            <Tabs defaultValue="behavior" className="w-full">
              <TabsList className="grid w-full grid-cols-4 h-auto">
                <TabsTrigger value="behavior" className="text-xs py-2">
                  <Target className="h-3 w-3 mr-1" />
                  Behavior
                </TabsTrigger>
                <TabsTrigger value="escalation" className="text-xs py-2">
                  <Clock className="h-3 w-3 mr-1" />
                  Escalation
                </TabsTrigger>
                <TabsTrigger value="consequences" className="text-xs py-2">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Outcomes
                </TabsTrigger>
                <TabsTrigger value="reskins" className="text-xs py-2">
                  <Sparkles className="h-3 w-3 mr-1" />
                  Reskins
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="behavior" className="mt-4 space-y-4">
                <div className="grid gap-3">
                  <div className="p-3 rounded-lg bg-muted/50 border border-border">
                    <div className="flex items-center gap-2 mb-1">
                      <Shield className="h-4 w-4 text-blue-400" />
                      <span className="text-sm font-medium">Default Tactic</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{archetype.behavior.defaultTactic}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50 border border-border">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle className="h-4 w-4 text-yellow-400" />
                      <span className="text-sm font-medium">Under Pressure</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{archetype.behavior.underPressure}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                      <div className="flex items-center gap-2 mb-1">
                        <CheckCircle className="h-4 w-4 text-green-400" />
                        <span className="text-sm font-medium text-green-400">When Winning</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{archetype.behavior.whenWinning}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                      <div className="flex items-center gap-2 mb-1">
                        <XCircle className="h-4 w-4 text-red-400" />
                        <span className="text-sm font-medium text-red-400">When Losing</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{archetype.behavior.whenLosing}</p>
                    </div>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="escalation" className="mt-4 space-y-4">
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <div className="flex items-center gap-2 mb-1">
                    <Timer className="h-4 w-4 text-amber-400" />
                    <span className="text-sm font-medium text-amber-400">Trigger</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{archetype.escalation.trigger}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Escalation Stages</p>
                  <div className="relative">
                    <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gradient-to-b from-green-500 via-yellow-500 to-red-500"></div>
                    {archetype.escalation.stages.map((stage, idx) => (
                      <div key={idx} className="flex items-start gap-4 mb-3 last:mb-0">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold z-10 ${
                          idx === 0 ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                          idx === 1 ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                          'bg-red-500/20 text-red-400 border border-red-500/30'
                        }`}>
                          {stage.stage}
                        </div>
                        <div className="flex-1 p-2 rounded bg-muted/30">
                          <p className="text-sm">{stage.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="consequences" className="mt-4 space-y-3">
                <div className="grid gap-3">
                  <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="h-4 w-4 text-green-400" />
                      <span className="text-sm font-medium text-green-400">If Players Succeed</span>
                    </div>
                    <ul className="space-y-1">
                      {archetype.consequences.ifPlayersSucceed.map((c, i) => (
                        <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                          <span className="text-green-400">•</span> {c}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                    <div className="flex items-center gap-2 mb-2">
                      <XCircle className="h-4 w-4 text-red-400" />
                      <span className="text-sm font-medium text-red-400">If Players Fail</span>
                    </div>
                    <ul className="space-y-1">
                      {archetype.consequences.ifPlayersFail.map((c, i) => (
                        <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                          <span className="text-red-400">•</span> {c}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Timer className="h-4 w-4 text-yellow-400" />
                      <span className="text-sm font-medium text-yellow-400">If Players Delay</span>
                    </div>
                    <ul className="space-y-1">
                      {archetype.consequences.ifPlayersDelay.map((c, i) => (
                        <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                          <span className="text-yellow-400">•</span> {c}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Lightbulb className="h-4 w-4 text-purple-400" />
                      <span className="text-sm font-medium text-purple-400">Unexpected Actions</span>
                    </div>
                    <ul className="space-y-1">
                      {archetype.consequences.unexpectedPlayerAction.map((c, i) => (
                        <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                          <span className="text-purple-400">•</span> {c}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="reskins" className="mt-4">
                <div className="flex flex-wrap gap-2">
                  {archetype.reskins.map((skin, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs">
                      {skin}
                    </Badge>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  Use any of these creature types with the same behavioral template
                </p>
              </TabsContent>
            </Tabs>
            
            <div className="p-4 rounded-lg bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20">
              <div className="flex items-start gap-3">
                <HelpCircle className="h-5 w-5 text-amber-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-amber-400 mb-1">DM Tip</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{archetype.dmNote}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

export default function ThreatArchetypes() {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterTier, setFilterTier] = useState<string>('all');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedArchetype, setSelectedArchetype] = useState<ThreatArchetype | null>(null);
  const [generatingArchetypeId, setGeneratingArchetypeId] = useState<string | null>(null);
  const [newMonster, setNewMonster] = useState({
    name: '',
    type: '',
    size: 'Medium',
    challenge_rating: '',
    description: '',
    archetype: ''
  });
  const { toast } = useToast();

  const filteredArchetypes = BEGINNER_THREAT_PACK.filter(a => {
    if (filterTier !== 'all' && a.threatTier !== filterTier) return false;
    if (filterRole !== 'all' && a.playstyleRole !== filterRole) return false;
    return true;
  });

  const createMonsterMutation = useMutation({
    mutationFn: async (data: any) => apiRequest("POST", "/api/monsters", data),
    onSuccess: () => {
      toast({ title: "Threat created as deployable monster!" });
      setShowCreateDialog(false);
      setNewMonster({ name: '', type: '', size: 'Medium', challenge_rating: '', description: '', archetype: '' });
      setSelectedArchetype(null);
      queryClient.invalidateQueries({ queryKey: ["/api/monsters"] });
    },
  });

  const aiGenerateMutation = useMutation({
    mutationFn: async (archetype: ThreatArchetype) => {
      setGeneratingArchetypeId(archetype.archetypeId);
      const res = await apiRequest("POST", "/api/ai-generate/threat-monster", { archetype });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ 
        title: "Threat Generated!", 
        description: `${data.name} (CR ${data.challenge_rating}) has been added to your Monsters as a deployable asset.`
      });
      queryClient.invalidateQueries({ queryKey: ["/api/monsters"] });
      setGeneratingArchetypeId(null);
    },
    onError: () => {
      setGeneratingArchetypeId(null);
    }
  });

  const handleCreate = (archetype: ThreatArchetype) => {
    setSelectedArchetype(archetype);
    const tierToCR: Record<string, string> = { low: '1', medium: '3', high: '6', apex: '10' };
    setNewMonster({
      name: '',
      type: archetype.reskins[0] || archetype.displayName,
      size: 'Medium',
      challenge_rating: tierToCR[archetype.threatTier] || '1',
      description: `${archetype.narrativeFunction.purpose}. ${archetype.behavior.defaultTactic}`,
      archetype: archetype.archetypeId
    });
    setShowCreateDialog(true);
  };

  const handleGenerate = (archetype: ThreatArchetype) => {
    aiGenerateMutation.mutate(archetype);
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent mb-2">
          Threat Archetypes
        </h2>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Narrative-first encounter templates. Pick a role, not stats. Every threat tells you exactly what it would do.
        </p>
      </div>

      <Card className="bg-gradient-to-r from-green-500/5 to-emerald-500/5 border-green-500/20">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
              <Lightbulb className="h-5 w-5 text-green-400" />
            </div>
            <div>
              <p className="font-medium text-green-400 mb-1">Beginner-Friendly Threat Pack</p>
              <p className="text-sm text-muted-foreground">
                These 5 archetypes cover 90% of encounters. Each one answers "what happens next?" so you never freeze. 
                Pick one, reskin it, and run with confidence.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Tier:</span>
          <div className="flex gap-1">
            <Button 
              size="sm" 
              variant={filterTier === 'all' ? 'default' : 'outline'}
              onClick={() => setFilterTier('all')}
              className="h-7 text-xs"
            >
              All
            </Button>
            {Object.entries(THREAT_TIER_INFO).map(([tier, info]) => (
              <Button
                key={tier}
                size="sm"
                variant={filterTier === tier ? 'default' : 'outline'}
                onClick={() => setFilterTier(tier)}
                className="h-7 text-xs"
              >
                {info.label}
              </Button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Role:</span>
          <div className="flex gap-1 flex-wrap">
            <Button 
              size="sm" 
              variant={filterRole === 'all' ? 'default' : 'outline'}
              onClick={() => setFilterRole('all')}
              className="h-7 text-xs"
            >
              All
            </Button>
            {Object.entries(PLAYSTYLE_ROLE_INFO).map(([role, info]) => (
              <Button
                key={role}
                size="sm"
                variant={filterRole === role ? 'default' : 'outline'}
                onClick={() => setFilterRole(role)}
                className="h-7 text-xs"
              >
                {info.icon} {info.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4">
        <AnimatePresence>
          {filteredArchetypes.map((archetype) => (
            <motion.div
              key={archetype.archetypeId}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <ThreatCard
                archetype={archetype}
                isExpanded={expandedId === archetype.archetypeId}
                onToggle={() => setExpandedId(
                  expandedId === archetype.archetypeId ? null : archetype.archetypeId
                )}
                onGenerate={handleGenerate}
                onCreate={handleCreate}
                isGenerating={generatingArchetypeId === archetype.archetypeId}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {filteredArchetypes.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          No archetypes match your filters. Try adjusting them.
        </div>
      )}

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Create {selectedArchetype?.displayName} Threat
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input 
              placeholder="Monster name" 
              value={newMonster.name} 
              onChange={(e) => setNewMonster({ ...newMonster, name: e.target.value })} 
            />
            <Input 
              placeholder="Type (e.g., Ogre, Bandit Captain...)" 
              value={newMonster.type} 
              onChange={(e) => setNewMonster({ ...newMonster, type: e.target.value })} 
            />
            <div className="grid grid-cols-2 gap-2">
              <Input 
                placeholder="Size" 
                value={newMonster.size} 
                onChange={(e) => setNewMonster({ ...newMonster, size: e.target.value })} 
              />
              <Input 
                placeholder="CR" 
                value={newMonster.challenge_rating} 
                onChange={(e) => setNewMonster({ ...newMonster, challenge_rating: e.target.value })} 
              />
            </div>
            <Textarea 
              placeholder="Description and behavior" 
              value={newMonster.description} 
              onChange={(e) => setNewMonster({ ...newMonster, description: e.target.value })} 
              rows={4}
            />
            {selectedArchetype && (
              <div className="text-xs text-muted-foreground p-2 bg-muted/30 rounded">
                <strong>Reskin suggestions:</strong> {selectedArchetype.reskins.join(', ')}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => createMonsterMutation.mutate(newMonster)} disabled={!newMonster.name || createMonsterMutation.isPending}>
              {createMonsterMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
              Create Threat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
