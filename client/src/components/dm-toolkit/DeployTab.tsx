import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Globe, 
  Users, 
  MapPin, 
  Scroll, 
  Package, 
  Swords, 
  Target,
  FileCode,
  Download,
  Loader2,
  Check,
  Info
} from "lucide-react";

export default function DeployTab() {
  const { toast } = useToast();
  const [campaignName, setCampaignName] = useState("");
  const [campaignDescription, setCampaignDescription] = useState("");
  const [difficulty, setDifficulty] = useState("beginner");
  const [style, setStyle] = useState("heroic");
  
  const [selectedNpcs, setSelectedNpcs] = useState<number[]>([]);
  const [selectedLocations, setSelectedLocations] = useState<number[]>([]);
  const [selectedQuests, setSelectedQuests] = useState<number[]>([]);
  const [selectedItems, setSelectedItems] = useState<number[]>([]);
  const [selectedMonsters, setSelectedMonsters] = useState<number[]>([]);

  const { data: npcs = [] } = useQuery<any[]>({
    queryKey: ["/api/npcs/companions"],
  });

  const { data: locations = [] } = useQuery<any[]>({
    queryKey: ["/api/locations"],
  });

  const { data: quests = [] } = useQuery<any[]>({
    queryKey: ["/api/quests"],
  });

  const { data: items = [] } = useQuery<any[]>({
    queryKey: ["/api/items"],
  });

  const { data: monsters = [] } = useQuery<any[]>({
    queryKey: ["/api/monsters"],
  });

  const toggleSelection = (id: number, selected: number[], setSelected: (ids: number[]) => void) => {
    if (selected.includes(id)) {
      setSelected(selected.filter(i => i !== id));
    } else {
      setSelected([...selected, id]);
    }
  };

  const selectAll = (items: any[], setSelected: (ids: number[]) => void) => {
    setSelected(items.map(i => i.id));
  };

  const createCampaignMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/campaigns", {
        title: campaignName,
        description: campaignDescription,
        difficulty: difficulty,
        narrativeStyle: style,
        selectedAssets: {
          npcs: selectedNpcs,
          locations: selectedLocations,
          quests: selectedQuests,
          items: selectedItems,
          monsters: selectedMonsters,
        },
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Campaign Created!",
        description: `"${campaignName}" is ready to play.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      setCampaignName("");
      setCampaignDescription("");
      setSelectedNpcs([]);
      setSelectedLocations([]);
      setSelectedQuests([]);
      setSelectedItems([]);
      setSelectedMonsters([]);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create campaign",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const exportAsCAML = () => {
    const selectedNpcData = npcs.filter((n: any) => selectedNpcs.includes(n.id));
    const selectedLocationData = locations.filter((l: any) => selectedLocations.includes(l.id));
    const selectedQuestData = quests.filter((q: any) => selectedQuests.includes(q.id));
    const selectedItemData = items.filter((i: any) => selectedItems.includes(i.id));
    const selectedMonsterData = monsters.filter((m: any) => selectedMonsters.includes(m.id));

    const timestamp = new Date().toISOString();
    const toId = (prefix: string, name: string) => `${prefix}_${name.replace(/\s+/g, '_')}`;

    const caml2 = {
      caml_version: "2.0",
      meta: {
        id: toId("campaign", campaignName || "Untitled"),
        title: campaignName || "Untitled Campaign",
        created_utc: timestamp,
        authors: ["Everdice DM Toolkit"],
        tags: [style],
        difficulty: difficulty,
      },
      world: {
        entities: {
          characters: [
            { id: "PC_Party", kind: "character", pc: true },
            ...selectedNpcData.map((npc: any) => ({
              id: toId("NPC", npc.name),
              kind: "character",
              name: npc.name,
              description: npc.description || npc.background,
              species: npc.race || "Human",
              class: npc.class || "Commoner",
            })),
          ],
          locations: selectedLocationData.map((loc: any) => ({
            id: toId("LOC", loc.name),
            kind: "location",
            name: loc.name,
            description: loc.description,
            tags: [loc.type || "area"],
          })),
          items: selectedItemData.map((item: any) => ({
            id: toId("ITEM", item.name),
            kind: "item",
            name: item.name,
            rarity: item.rarity || "common",
            description: item.description,
          })),
          monsters: selectedMonsterData.map((monster: any) => ({
            id: toId("MONSTER", monster.name),
            kind: "creature",
            name: monster.name,
            type: monster.type,
            cr: monster.challengeRating,
            description: monster.description,
          })),
          factions: [],
        },
        connections: [],
      },
      state: {
        facts: [
          ...selectedNpcData.map((npc: any) => ({
            id: `STATE_${toId("NPC", npc.name)}_Attitude`,
            bearer: toId("NPC", npc.name),
            type: "attitude",
            value: npc.alignment?.includes("Evil") ? "hostile" : "neutral",
          })),
          ...selectedQuestData.map((quest: any) => ({
            id: `STATE_${toId("QUEST", quest.title)}_Status`,
            bearer: toId("QUEST", quest.title),
            type: "quest_status",
            value: "available",
          })),
        ],
      },
      roles: {
        assignments: selectedQuestData.length > 0 && selectedNpcData.length > 0 
          ? [{
              id: "ROLE_QuestGiver_Main",
              role: "QuestGiver",
              holder: toId("NPC", selectedNpcData[0]?.name),
              notes: selectedQuestData[0]?.description || "Main quest",
            }] 
          : [],
      },
      processes: {
        catalog: selectedQuestData.map((quest: any) => ({
          id: toId("PROC", quest.title),
          type: "quest",
          name: quest.title,
          description: quest.description,
          objectives: [],
          rewards: quest.rewards || {},
        })),
      },
      transitions: {
        changes: selectedQuestData.map((quest: any) => ({
          id: `TR_${toId("QUEST", quest.title)}_Complete`,
          caused_by: toId("PROC", quest.title),
          ops: [{ op: "update_state", state_id: `STATE_${toId("QUEST", quest.title)}_Status`, value: "complete" }],
        })),
      },
      snapshots: {
        timeline: [
          {
            id: "SNAP_Initial",
            time_utc: timestamp,
            world_hash: "initial",
            state_hash: "initial",
            roles_hash: "initial",
            narration: campaignDescription || "The adventure begins.",
          },
        ],
      },
    };

    const jsonContent = JSON.stringify(caml2, null, 2);
    const blob = new Blob([jsonContent], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(campaignName || "campaign").replace(/\s+/g, "_")}.caml2.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "CAML 2.0 Exported",
      description: "Your campaign has been exported successfully.",
    });
  };

  const totalSelected = selectedNpcs.length + selectedLocations.length + selectedQuests.length + selectedItems.length + selectedMonsters.length;
  const canCreate = campaignName.trim() && totalSelected > 0;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-fantasy font-semibold flex items-center">
            <Globe className="h-5 w-5 mr-2 text-primary" />
            Deploy Created Assets to Campaign
          </h2>
          <p className="text-muted-foreground">Turn your creations into a deployable campaign for players</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-900/30 to-blue-900/30 border border-purple-500/30">
          <FileCode className="h-4 w-4 text-purple-400" />
          <span className="text-sm font-medium text-purple-300">CAML 2.0 Compatible</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Globe className="h-5 w-5 mr-2 text-primary" />
              Create Campaign from Assets
            </CardTitle>
            <CardDescription>
              Generate a new campaign using the assets you've created
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="campaign-name">Campaign Name *</Label>
              <Input 
                id="campaign-name" 
                placeholder="Enter a name for your campaign"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="campaign-description">Description</Label>
              <Textarea 
                id="campaign-description" 
                placeholder="Describe your campaign to potential players"
                value={campaignDescription}
                onChange={(e) => setCampaignDescription(e.target.value)}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Difficulty</Label>
                <Select value={difficulty} onValueChange={setDifficulty}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="beginner">Beginner</SelectItem>
                    <SelectItem value="intermediate">Intermediate</SelectItem>
                    <SelectItem value="advanced">Advanced</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Style</Label>
                <Select value={style} onValueChange={setStyle}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="heroic">Heroic</SelectItem>
                    <SelectItem value="gritty">Gritty</SelectItem>
                    <SelectItem value="mystery">Mystery</SelectItem>
                    <SelectItem value="horror">Horror</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex gap-2">
            <Button 
              className="flex-1"
              onClick={() => createCampaignMutation.mutate()}
              disabled={!canCreate || createCampaignMutation.isPending}
            >
              {createCampaignMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Create Deployable Campaign
                </>
              )}
            </Button>
            <Button 
              variant="outline"
              onClick={exportAsCAML}
              disabled={totalSelected === 0}
              className="border-purple-500/50 hover:bg-purple-900/20"
            >
              <Download className="h-4 w-4 mr-2" />
              Export CAML
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Your Created Assets</CardTitle>
            <CardDescription>
              Select assets to include in your campaign ({totalSelected} selected)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-4">
                <AssetSection
                  title="NPCs"
                  icon={<Users className="h-4 w-4 text-rose-500" />}
                  items={npcs}
                  selected={selectedNpcs}
                  onToggle={(id) => toggleSelection(id, selectedNpcs, setSelectedNpcs)}
                  onSelectAll={() => selectAll(npcs, setSelectedNpcs)}
                />

                <AssetSection
                  title="Locations"
                  icon={<MapPin className="h-4 w-4 text-emerald-500" />}
                  items={locations}
                  selected={selectedLocations}
                  onToggle={(id) => toggleSelection(id, selectedLocations, setSelectedLocations)}
                  onSelectAll={() => selectAll(locations, setSelectedLocations)}
                />

                <AssetSection
                  title="Quests"
                  icon={<Scroll className="h-4 w-4 text-amber-500" />}
                  items={quests}
                  selected={selectedQuests}
                  onToggle={(id) => toggleSelection(id, selectedQuests, setSelectedQuests)}
                  onSelectAll={() => selectAll(quests, setSelectedQuests)}
                />

                <AssetSection
                  title="Items"
                  icon={<Package className="h-4 w-4 text-cyan-500" />}
                  items={items}
                  selected={selectedItems}
                  onToggle={(id) => toggleSelection(id, selectedItems, setSelectedItems)}
                  onSelectAll={() => selectAll(items, setSelectedItems)}
                />

                <AssetSection
                  title="Monsters"
                  icon={<Swords className="h-4 w-4 text-red-500" />}
                  items={monsters}
                  selected={selectedMonsters}
                  onToggle={(id) => toggleSelection(id, selectedMonsters, setSelectedMonsters)}
                  onSelectAll={() => selectAll(monsters, setSelectedMonsters)}
                />
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <Card className="border-primary/20 bg-secondary/10">
        <CardHeader>
          <CardTitle className="flex items-center text-primary">
            <Info className="mr-2 h-5 w-5" />
            About Campaign Deployment
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Deployment allows you to create a fully playable campaign from your assets that can be:
          </p>
          <ul className="text-sm text-muted-foreground space-y-2 list-disc pl-5">
            <li>Shared with other players using a join code</li>
            <li>Run by you as the DM for a live group</li>
            <li>Exported as CAML 2.0 for use with other tools like Foundry VTT</li>
            <li>Made public in the campaign directory for anyone to discover</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function AssetSection({ 
  title, 
  icon, 
  items, 
  selected, 
  onToggle, 
  onSelectAll 
}: { 
  title: string;
  icon: React.ReactNode;
  items: any[];
  selected: number[];
  onToggle: (id: number) => void;
  onSelectAll: () => void;
}) {
  if (items.length === 0) {
    return (
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <Label className="flex items-center gap-2">
            {icon}
            {title}
          </Label>
          <Badge variant="outline" className="text-muted-foreground">None created</Badge>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <Label className="flex items-center gap-2">
          {icon}
          {title}
        </Label>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{selected.length} / {items.length}</Badge>
          <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={onSelectAll}>
            All
          </Button>
        </div>
      </div>
      <div className="border rounded-md p-2 space-y-1 max-h-32 overflow-y-auto">
        {items.map((item: any) => (
          <div key={item.id} className="flex items-center space-x-2">
            <Checkbox 
              id={`${title}-${item.id}`}
              checked={selected.includes(item.id)}
              onCheckedChange={() => onToggle(item.id)}
            />
            <Label htmlFor={`${title}-${item.id}`} className="text-sm cursor-pointer flex-1 truncate">
              {item.name || item.title}
            </Label>
          </div>
        ))}
      </div>
    </div>
  );
}
