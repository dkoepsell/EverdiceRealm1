import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { 
  Upload, 
  Download, 
  Sparkles, 
  FileJson, 
  FileText, 
  Network, 
  Loader2,
  Check,
  Copy,
  ExternalLink
} from 'lucide-react';
import { AdventureGraph } from './AdventureGraph';

interface CAMLManagerProps {
  campaignId?: number;
  onImportComplete?: (campaignId: number) => void;
}

export function CAMLManager({ campaignId, onImportComplete }: CAMLManagerProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('import');
  const [importContent, setImportContent] = useState('');
  const [importFormat, setImportFormat] = useState<'json' | 'yaml'>('json');
  const [createCampaign, setCreateCampaign] = useState(true);
  const [parsedPreview, setParsedPreview] = useState<any>(null);
  
  const [generateTitle, setGenerateTitle] = useState('');
  const [generateTheme, setGenerateTheme] = useState('exploration and mystery');
  const [generateSetting, setGenerateSetting] = useState('fantasy dungeon');
  const [generateMinLevel, setGenerateMinLevel] = useState(1);
  const [generateMaxLevel, setGenerateMaxLevel] = useState(5);
  const [generateEncounterCount, setGenerateEncounterCount] = useState(5);
  const [includeQuests, setIncludeQuests] = useState(true);
  const [includePuzzles, setIncludePuzzles] = useState(true);
  const [generatedAdventure, setGeneratedAdventure] = useState<any>(null);

  const importMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/caml/import', {
        content: importContent,
        format: importFormat,
        createCampaign
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Adventure Imported',
        description: createCampaign 
          ? `Created campaign with ${data.imported?.npcs || 0} NPCs, ${data.imported?.quests || 0} quests`
          : 'Adventure parsed successfully'
      });
      if (createCampaign && data.campaignId && onImportComplete) {
        queryClient.invalidateQueries({ queryKey: ['/api/campaigns'] });
        onImportComplete(data.campaignId);
      }
      if (!createCampaign) {
        setParsedPreview(data);
      }
    },
    onError: (error: any) => {
      toast({
        title: 'Import Failed',
        description: error.message || 'Failed to import adventure',
        variant: 'destructive'
      });
    }
  });

  const parseMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/caml/parse', {
        content: importContent,
        format: importFormat
      });
      return response.json();
    },
    onSuccess: (data) => {
      setParsedPreview(data);
      toast({
        title: 'Adventure Parsed',
        description: `Found ${data.entityCount} entities`
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Parse Failed',
        description: error.message || 'Failed to parse CAML content',
        variant: 'destructive'
      });
    }
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/caml/generate', {
        title: generateTitle,
        theme: generateTheme,
        setting: generateSetting,
        minLevel: generateMinLevel,
        maxLevel: generateMaxLevel,
        encounterCount: generateEncounterCount,
        includeQuests,
        includePuzzles
      });
      return response.json();
    },
    onSuccess: (data) => {
      setGeneratedAdventure(data);
      toast({
        title: 'Adventure Generated',
        description: `Created "${data.adventure?.title || 'New Adventure'}"`
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Generation Failed',
        description: error.message || 'Failed to generate adventure',
        variant: 'destructive'
      });
    }
  });

  const useAdventureMutation = useMutation({
    mutationFn: async (adventureJson: string) => {
      const response = await apiRequest('POST', '/api/caml/import', {
        content: adventureJson,
        format: 'json',
        createCampaign: true
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Campaign Created!',
        description: `Your adventure is now available in Campaigns with ${data.imported?.npcs || 0} NPCs and ${data.imported?.quests || 0} quests`
      });
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns'] });
      if (data.campaignId && onImportComplete) {
        onImportComplete(data.campaignId);
      }
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to Create Campaign',
        description: error.message || 'Failed to create campaign from adventure',
        variant: 'destructive'
      });
    }
  });

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setImportContent(content);
      if (file.name.endsWith('.yaml') || file.name.endsWith('.yml')) {
        setImportFormat('yaml');
      } else {
        setImportFormat('json');
      }
    };
    reader.readAsText(file);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied to clipboard' });
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Network className="h-5 w-5" />
          CAML Adventure Manager
        </CardTitle>
        <CardDescription>
          Import, export, and generate structured D&D adventures using CAML format
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="import" data-testid="tab-import">
              <Upload className="h-4 w-4 mr-2" />
              Import
            </TabsTrigger>
            <TabsTrigger value="export" data-testid="tab-export">
              <Download className="h-4 w-4 mr-2" />
              Export
            </TabsTrigger>
            <TabsTrigger value="generate" data-testid="tab-generate">
              <Sparkles className="h-4 w-4 mr-2" />
              Generate
            </TabsTrigger>
            <TabsTrigger value="graph" data-testid="tab-graph">
              <Network className="h-4 w-4 mr-2" />
              Graph
            </TabsTrigger>
          </TabsList>

          <TabsContent value="import" className="space-y-4">
            <div className="space-y-4">
              <div>
                <Label>Upload CAML File</Label>
                <Input
                  type="file"
                  accept=".json,.yaml,.yml"
                  onChange={handleFileUpload}
                  data-testid="input-file-upload"
                />
              </div>
              
              <div className="flex items-center gap-4">
                <Label>Format:</Label>
                <Select value={importFormat} onValueChange={(v) => setImportFormat(v as any)}>
                  <SelectTrigger className="w-32" data-testid="select-format">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="json">JSON</SelectItem>
                    <SelectItem value="yaml">YAML</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Or paste CAML content directly:</Label>
                <Textarea
                  placeholder="Paste CAML JSON or YAML here..."
                  value={importContent}
                  onChange={(e) => setImportContent(e.target.value)}
                  className="h-48 font-mono text-sm"
                  data-testid="textarea-import-content"
                />
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={createCampaign}
                  onCheckedChange={setCreateCampaign}
                  data-testid="switch-create-campaign"
                />
                <Label>Create campaign from import</Label>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={() => parseMutation.mutate()}
                  disabled={!importContent || parseMutation.isPending}
                  variant="outline"
                  data-testid="button-preview"
                >
                  {parseMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Preview
                </Button>
                <Button
                  onClick={() => importMutation.mutate()}
                  disabled={!importContent || importMutation.isPending}
                  data-testid="button-import"
                >
                  {importMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  <Upload className="h-4 w-4 mr-2" />
                  Import Adventure
                </Button>
              </div>

              {parsedPreview && (
                <Card className="bg-muted/50">
                  <CardHeader>
                    <CardTitle className="text-lg">{parsedPreview.adventure?.title || 'Parsed Adventure'}</CardTitle>
                    <CardDescription>{parsedPreview.adventure?.synopsis}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>Entities: {parsedPreview.entityCount || Object.keys(parsedPreview.campaignData || {}).length}</div>
                      <div>Locations: {parsedPreview.adventure?.locations?.length || 0}</div>
                      <div>NPCs: {parsedPreview.adventure?.npcs?.length || 0}</div>
                      <div>Encounters: {parsedPreview.adventure?.encounters?.length || 0}</div>
                      <div>Quests: {parsedPreview.adventure?.quests?.length || 0}</div>
                      <div>Items: {parsedPreview.adventure?.items?.length || 0}</div>
                    </div>
                    {parsedPreview.graph && (
                      <div className="mt-4">
                        <AdventureGraph graph={parsedPreview.graph} />
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="export" className="space-y-4">
            {campaignId ? (
              <div className="space-y-4">
                <p className="text-muted-foreground">
                  Export your campaign as a CAML file for sharing or use in other tools like Foundry VTT.
                </p>
                <div className="flex gap-2">
                  <Button
                    onClick={() => window.open(`/api/campaigns/${campaignId}/export/caml?format=json`, '_blank')}
                    data-testid="button-export-json"
                  >
                    <FileJson className="h-4 w-4 mr-2" />
                    Export as JSON
                  </Button>
                  <Button
                    onClick={() => window.open(`/api/campaigns/${campaignId}/export/caml?format=yaml`, '_blank')}
                    variant="outline"
                    data-testid="button-export-yaml"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Export as YAML
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground">
                Select a campaign to export it as CAML.
              </p>
            )}
          </TabsContent>

          <TabsContent value="generate" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Adventure Title</Label>
                <Input
                  placeholder="The Lost Temple"
                  value={generateTitle}
                  onChange={(e) => setGenerateTitle(e.target.value)}
                  data-testid="input-generate-title"
                />
              </div>
              <div className="space-y-2">
                <Label>Theme</Label>
                <Select value={generateTheme} onValueChange={setGenerateTheme}>
                  <SelectTrigger data-testid="select-theme">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="exploration and mystery">Exploration & Mystery</SelectItem>
                    <SelectItem value="combat and action">Combat & Action</SelectItem>
                    <SelectItem value="intrigue and politics">Intrigue & Politics</SelectItem>
                    <SelectItem value="horror and survival">Horror & Survival</SelectItem>
                    <SelectItem value="treasure hunting">Treasure Hunting</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Setting</Label>
                <Select value={generateSetting} onValueChange={setGenerateSetting}>
                  <SelectTrigger data-testid="select-setting">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fantasy dungeon">Fantasy Dungeon</SelectItem>
                    <SelectItem value="haunted castle">Haunted Castle</SelectItem>
                    <SelectItem value="enchanted forest">Enchanted Forest</SelectItem>
                    <SelectItem value="underground caverns">Underground Caverns</SelectItem>
                    <SelectItem value="ancient ruins">Ancient Ruins</SelectItem>
                    <SelectItem value="coastal town">Coastal Town</SelectItem>
                    <SelectItem value="mountain fortress">Mountain Fortress</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Encounter Count</Label>
                <Input
                  type="number"
                  min={3}
                  max={10}
                  value={generateEncounterCount}
                  onChange={(e) => setGenerateEncounterCount(parseInt(e.target.value) || 5)}
                  data-testid="input-encounter-count"
                />
              </div>
              <div className="space-y-2">
                <Label>Min Level</Label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={generateMinLevel}
                  onChange={(e) => setGenerateMinLevel(parseInt(e.target.value) || 1)}
                  data-testid="input-min-level"
                />
              </div>
              <div className="space-y-2">
                <Label>Max Level</Label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={generateMaxLevel}
                  onChange={(e) => setGenerateMaxLevel(parseInt(e.target.value) || 5)}
                  data-testid="input-max-level"
                />
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  checked={includeQuests}
                  onCheckedChange={setIncludeQuests}
                  data-testid="switch-include-quests"
                />
                <Label>Include Quests</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={includePuzzles}
                  onCheckedChange={setIncludePuzzles}
                  data-testid="switch-include-puzzles"
                />
                <Label>Include Puzzles</Label>
              </div>
            </div>

            <Button
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
              className="w-full"
              data-testid="button-generate"
            >
              {generateMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating Adventure...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate CAML Adventure
                </>
              )}
            </Button>

            {generatedAdventure && (
              <Card className="bg-muted/50">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Check className="h-5 w-5 text-green-500" />
                    {generatedAdventure.adventure?.title || 'Generated Adventure'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>Locations: {generatedAdventure.adventure?.locations?.length || 0}</div>
                    <div>NPCs: {generatedAdventure.adventure?.npcs?.length || 0}</div>
                    <div>Encounters: {generatedAdventure.adventure?.encounters?.length || 0}</div>
                    <div>Quests: {generatedAdventure.adventure?.quests?.length || 0}</div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(generatedAdventure.json)}
                      data-testid="button-copy-json"
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copy JSON
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(generatedAdventure.yaml)}
                      data-testid="button-copy-yaml"
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copy YAML
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => useAdventureMutation.mutate(generatedAdventure.json)}
                      disabled={useAdventureMutation.isPending}
                      data-testid="button-use-adventure"
                    >
                      {useAdventureMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Creating Campaign...
                        </>
                      ) : (
                        'Use This Adventure'
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="graph" className="space-y-4">
            {campaignId ? (
              <CampaignAdventureGraph campaignId={campaignId} />
            ) : parsedPreview?.graph ? (
              <AdventureGraph graph={parsedPreview.graph} />
            ) : generatedAdventure ? (
              <div className="space-y-4">
                <p style={{ color: '#0f172a' }}>
                  Generated adventure graph:
                </p>
                <AdventureGraph graph={{
                  nodes: [
                    { id: 'adventure', type: 'AdventureModule', name: generatedAdventure.adventure?.title || 'Generated Adventure' },
                    ...(generatedAdventure.adventure?.locations || []).map((loc: any) => ({ id: loc.id, type: 'Location', name: loc.name })),
                    ...(generatedAdventure.adventure?.npcs || []).map((npc: any) => ({ id: npc.id, type: 'NPC', name: npc.name })),
                    ...(generatedAdventure.adventure?.encounters || []).map((enc: any) => ({ id: enc.id, type: 'Encounter', name: enc.name })),
                    ...(generatedAdventure.adventure?.quests || []).map((q: any) => ({ id: q.id, type: 'Quest', name: q.name })),
                    ...(generatedAdventure.adventure?.items || []).map((item: any) => ({ id: item.id, type: 'Item', name: item.name })),
                  ],
                  edges: []
                }} />
              </div>
            ) : (
              <div className="text-center py-8 space-y-4">
                <p className="text-muted-foreground">
                  No adventure graph available.
                </p>
                <p className="text-sm text-muted-foreground">
                  To view an adventure graph, either:
                </p>
                <ul className="text-sm text-muted-foreground list-disc list-inside">
                  <li>Import a CAML adventure file and click "Preview"</li>
                  <li>Generate an adventure using the "Generate" tab</li>
                  <li>Access this page from a specific campaign</li>
                </ul>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function CampaignAdventureGraph({ campaignId }: { campaignId: number }) {
  const { data: graph, isLoading, error } = useQuery({
    queryKey: [`/api/campaigns/${campaignId}/adventure-graph`],
    enabled: !!campaignId
  });

  console.log('Adventure graph query:', { campaignId, isLoading, error, graph });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!graph || (graph.nodes?.length === 0)) {
    return (
      <div className="text-center py-8 space-y-2">
        <p className="text-muted-foreground">No adventure graph available for this campaign.</p>
        <p className="text-sm text-muted-foreground">
          The graph is built from campaign NPCs, quests, locations, and encounters.
        </p>
      </div>
    );
  }

  return <AdventureGraph graph={graph} />;
}
