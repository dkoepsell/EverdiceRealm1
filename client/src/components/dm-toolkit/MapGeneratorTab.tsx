import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Loader2, Map, Download, Share, Sparkles, Grid, Mountain, Trees, Droplets } from "lucide-react";

const mapTypes = [
  { value: "dungeon", label: "Dungeon", icon: Mountain },
  { value: "city", label: "City", icon: Grid },
  { value: "wilderness", label: "Wilderness", icon: Trees },
  { value: "regional", label: "Regional", icon: Map },
  { value: "battle", label: "Battle Map", icon: Grid },
  { value: "building", label: "Building", icon: Grid }
];

const mapSizes = [
  { value: "small", label: "Small (20x20)", dimensions: "20x20" },
  { value: "medium", label: "Medium (30x30)", dimensions: "30x30" },
  { value: "large", label: "Large (40x40)", dimensions: "40x40" },
  { value: "huge", label: "Huge (50x50)", dimensions: "50x50" },
  { value: "custom", label: "Custom", dimensions: "Custom" }
];

interface MapForm {
  name: string;
  description: string;
  mapType: string;
  size: string;
  width: number;
  height: number;
  theme: string;
  features: string;
  gridSize: number;
  includeGrid: boolean;
  includeLegend: boolean;
}

export default function MapGeneratorTab() {
  const { toast } = useToast();
  const [mapForm, setMapForm] = useState<MapForm>({
    name: "",
    description: "",
    mapType: "dungeon",
    size: "medium",
    width: 30,
    height: 30,
    theme: "",
    features: "",
    gridSize: 5,
    includeGrid: true,
    includeLegend: true
  });

  // Fetch user's maps
  const { data: userMaps = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/maps/user"],
    refetchOnWindowFocus: false
  });

  // Generate map mutation
  const generateMapMutation = useMutation({
    mutationFn: async (mapData: any) => {
      const response = await apiRequest('POST', '/api/maps/generate', mapData);
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Map Generated",
        description: "Your map has been generated successfully."
      });
      queryClient.invalidateQueries({ queryKey: ["/api/maps/user"] });
    },
    onError: (error: any) => {
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate map.",
        variant: "destructive"
      });
    }
  });

  // Save map mutation
  const saveMapMutation = useMutation({
    mutationFn: async (mapData: any) => {
      const response = await apiRequest('POST', '/api/maps', mapData);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Map Saved",
        description: "Your map has been saved successfully."
      });
      queryClient.invalidateQueries({ queryKey: ["/api/maps/user"] });
    },
    onError: (error: any) => {
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save map.",
        variant: "destructive"
      });
    }
  });

  const handleGenerateMap = () => {
    if (!mapForm.name) {
      toast({
        title: "Missing Information",
        description: "Please provide a map name.",
        variant: "destructive"
      });
      return;
    }

    generateMapMutation.mutate(mapForm);
  };

  const handleSizeChange = (size: string) => {
    setMapForm({ ...mapForm, size });
    if (size !== "custom") {
      const sizeData = mapSizes.find(s => s.value === size);
      if (sizeData && sizeData.dimensions !== "Custom") {
        const [width, height] = sizeData.dimensions.split('x').map(Number);
        setMapForm(prev => ({ ...prev, size, width, height }));
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Map Generation Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Map className="h-5 w-5" />
              Generate Map
            </CardTitle>
            <CardDescription>
              Create detailed maps for your campaigns with AI assistance
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Map Name</Label>
                <Input
                  id="name"
                  value={mapForm.name}
                  onChange={(e) => setMapForm({ ...mapForm, name: e.target.value })}
                  placeholder="The Sunken Temple"
                />
              </div>
              <div>
                <Label htmlFor="mapType">Map Type</Label>
                <Select value={mapForm.mapType} onValueChange={(value) => setMapForm({ ...mapForm, mapType: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {mapTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        <div className="flex items-center gap-2">
                          <type.icon className="h-4 w-4" />
                          {type.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={mapForm.description}
                onChange={(e) => setMapForm({ ...mapForm, description: e.target.value })}
                placeholder="An ancient temple complex with flooded chambers and crumbling walls..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="size">Map Size</Label>
                <Select value={mapForm.size} onValueChange={handleSizeChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {mapSizes.map((size) => (
                      <SelectItem key={size.value} value={size.value}>
                        {size.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="theme">Theme</Label>
                <Input
                  id="theme"
                  value={mapForm.theme}
                  onChange={(e) => setMapForm({ ...mapForm, theme: e.target.value })}
                  placeholder="Dark fantasy, tropical, arctic..."
                />
              </div>
            </div>

            {mapForm.size === "custom" && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="width">Width (squares)</Label>
                  <Input
                    id="width"
                    type="number"
                    value={mapForm.width}
                    onChange={(e) => setMapForm({ ...mapForm, width: parseInt(e.target.value) || 30 })}
                    min="10"
                    max="100"
                  />
                </div>
                <div>
                  <Label htmlFor="height">Height (squares)</Label>
                  <Input
                    id="height"
                    type="number"
                    value={mapForm.height}
                    onChange={(e) => setMapForm({ ...mapForm, height: parseInt(e.target.value) || 30 })}
                    min="10"
                    max="100"
                  />
                </div>
              </div>
            )}

            <div>
              <Label htmlFor="features">Special Features</Label>
              <Textarea
                id="features"
                value={mapForm.features}
                onChange={(e) => setMapForm({ ...mapForm, features: e.target.value })}
                placeholder="Secret passages, trapped rooms, water features, elevation changes..."
                rows={2}
              />
            </div>

            <div>
              <Label htmlFor="gridSize">Grid Size (feet per square): {mapForm.gridSize}</Label>
              <Slider
                value={[mapForm.gridSize]}
                onValueChange={([value]) => setMapForm({ ...mapForm, gridSize: value })}
                max={10}
                min={1}
                step={1}
                className="mt-2"
              />
            </div>

            <div className="flex gap-4">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="includeGrid"
                  checked={mapForm.includeGrid}
                  onChange={(e) => setMapForm({ ...mapForm, includeGrid: e.target.checked })}
                  className="rounded"
                />
                <Label htmlFor="includeGrid">Include Grid</Label>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="includeLegend"
                  checked={mapForm.includeLegend}
                  onChange={(e) => setMapForm({ ...mapForm, includeLegend: e.target.checked })}
                  className="rounded"
                />
                <Label htmlFor="includeLegend">Include Legend</Label>
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <Button 
                onClick={handleGenerateMap}
                disabled={generateMapMutation.isPending}
                className="flex-1"
              >
                {generateMapMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                Generate Map
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* User's Maps */}
        <Card>
          <CardHeader>
            <CardTitle>Your Maps</CardTitle>
            <CardDescription>
              Maps you've generated for your campaigns
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : userMaps.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No maps generated yet
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {userMaps.map((map: any) => (
                  <div key={map.id} className="border rounded-lg p-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold">{map.name}</h4>
                          <Badge variant="secondary" className="text-xs">
                            {map.mapType}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {map.width}x{map.height}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {map.description}
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span>Grid: {map.gridSize}ft</span>
                          {map.theme && <span>{map.theme}</span>}
                        </div>
                        <div className="flex gap-2 mt-2">
                          <Button size="sm" variant="outline">
                            <Download className="h-3 w-3 mr-1" />
                            Download
                          </Button>
                          <Button size="sm" variant="outline">
                            <Share className="h-3 w-3 mr-1" />
                            Share
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}