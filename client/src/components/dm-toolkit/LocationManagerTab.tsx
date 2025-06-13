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
import { Loader2, MapPin, Castle, Trees, Building, Mountain, Droplets, Globe, Sparkles } from "lucide-react";

const locationTypes = [
  { value: "city", label: "City", icon: Building },
  { value: "town", label: "Town", icon: Building },
  { value: "village", label: "Village", icon: Building },
  { value: "castle", label: "Castle", icon: Castle },
  { value: "dungeon", label: "Dungeon", icon: Mountain },
  { value: "forest", label: "Forest", icon: Trees },
  { value: "mountain", label: "Mountain", icon: Mountain },
  { value: "lake", label: "Lake", icon: Droplets },
  { value: "ocean", label: "Ocean", icon: Droplets },
  { value: "plains", label: "Plains", icon: Globe },
  { value: "desert", label: "Desert", icon: Globe },
  { value: "swamp", label: "Swamp", icon: Trees },
  { value: "ruins", label: "Ruins", icon: Castle },
  { value: "tavern", label: "Tavern", icon: Building },
  { value: "temple", label: "Temple", icon: Castle },
  { value: "other", label: "Other", icon: MapPin }
];

const locationSizes = [
  { value: "tiny", label: "Tiny (Single Room)" },
  { value: "small", label: "Small (Building/Area)" },
  { value: "medium", label: "Medium (District/Grove)" },
  { value: "large", label: "Large (City/Forest)" },
  { value: "huge", label: "Huge (Region/Kingdom)" }
];

interface LocationForm {
  name: string;
  description: string;
  locationType: string;
  size: string;
  climate: string;
  population: string;
  notableFeatures: string;
  dangers: string;
  resources: string;
  connections: string;
}

export default function LocationManagerTab() {
  const { toast } = useToast();
  const [locationForm, setLocationForm] = useState<LocationForm>({
    name: "",
    description: "",
    locationType: "town",
    size: "medium",
    climate: "",
    population: "",
    notableFeatures: "",
    dangers: "",
    resources: "",
    connections: ""
  });

  // Fetch user's locations
  const { data: userLocations = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/locations/user"],
    refetchOnWindowFocus: false
  });

  // Create location mutation
  const createLocationMutation = useMutation({
    mutationFn: async (locationData: any) => {
      const response = await apiRequest('POST', '/api/locations', locationData);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Location Created",
        description: "Your location has been created successfully."
      });
      queryClient.invalidateQueries({ queryKey: ["/api/locations/user"] });
      setLocationForm({
        name: "",
        description: "",
        locationType: "town",
        size: "medium",
        climate: "",
        population: "",
        notableFeatures: "",
        dangers: "",
        resources: "",
        connections: ""
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Create Location",
        description: error.message || "An error occurred while creating the location.",
        variant: "destructive"
      });
    }
  });

  // AI Generate Location mutation
  const generateLocationMutation = useMutation({
    mutationFn: async (prompt: string) => {
      const response = await apiRequest('POST', '/api/locations/generate', { prompt });
      return await response.json();
    },
    onSuccess: (data) => {
      setLocationForm({
        ...locationForm,
        ...data
      });
      toast({
        title: "Location Generated",
        description: "AI has generated location details. Review and create when ready."
      });
    },
    onError: (error: any) => {
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate location with AI.",
        variant: "destructive"
      });
    }
  });

  const handleGenerateLocation = async () => {
    const prompt = `Create a ${locationForm.size} ${locationForm.locationType} ${locationForm.name ? `called "${locationForm.name}"` : ''}. ${locationForm.description || ''}`;
    generateLocationMutation.mutate(prompt);
  };

  const handleCreateLocation = () => {
    if (!locationForm.name || !locationForm.description) {
      toast({
        title: "Missing Information",
        description: "Please provide at least a name and description.",
        variant: "destructive"
      });
      return;
    }

    createLocationMutation.mutate(locationForm);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Location Creation Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Create Location
            </CardTitle>
            <CardDescription>
              Design locations for your campaign world with AI assistance
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Location Name</Label>
                <Input
                  id="name"
                  value={locationForm.name}
                  onChange={(e) => setLocationForm({ ...locationForm, name: e.target.value })}
                  placeholder="Silverbrook Village"
                />
              </div>
              <div>
                <Label htmlFor="locationType">Type</Label>
                <Select value={locationForm.locationType} onValueChange={(value) => setLocationForm({ ...locationForm, locationType: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {locationTypes.map((type) => (
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
                value={locationForm.description}
                onChange={(e) => setLocationForm({ ...locationForm, description: e.target.value })}
                placeholder="A peaceful village nestled beside a crystal-clear brook..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="size">Size</Label>
                <Select value={locationForm.size} onValueChange={(value) => setLocationForm({ ...locationForm, size: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {locationSizes.map((size) => (
                      <SelectItem key={size.value} value={size.value}>
                        {size.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="climate">Climate</Label>
                <Input
                  id="climate"
                  value={locationForm.climate}
                  onChange={(e) => setLocationForm({ ...locationForm, climate: e.target.value })}
                  placeholder="Temperate, mild winters"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="population">Population</Label>
              <Input
                id="population"
                value={locationForm.population}
                onChange={(e) => setLocationForm({ ...locationForm, population: e.target.value })}
                placeholder="About 200 villagers, mostly farmers and craftsmen"
              />
            </div>

            <div>
              <Label htmlFor="notableFeatures">Notable Features</Label>
              <Textarea
                id="notableFeatures"
                value={locationForm.notableFeatures}
                onChange={(e) => setLocationForm({ ...locationForm, notableFeatures: e.target.value })}
                placeholder="Ancient stone bridge, mystical grove, bustling marketplace..."
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="dangers">Dangers</Label>
                <Textarea
                  id="dangers"
                  value={locationForm.dangers}
                  onChange={(e) => setLocationForm({ ...locationForm, dangers: e.target.value })}
                  placeholder="Bandits on nearby roads, wild wolves in the forest..."
                  rows={2}
                />
              </div>
              <div>
                <Label htmlFor="resources">Resources</Label>
                <Textarea
                  id="resources"
                  value={locationForm.resources}
                  onChange={(e) => setLocationForm({ ...locationForm, resources: e.target.value })}
                  placeholder="Fresh water, fertile farmland, iron ore deposits..."
                  rows={2}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="connections">Connections</Label>
              <Textarea
                id="connections"
                value={locationForm.connections}
                onChange={(e) => setLocationForm({ ...locationForm, connections: e.target.value })}
                placeholder="Connected to Goldport by the King's Road, trade routes to the capital..."
                rows={2}
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button 
                onClick={handleGenerateLocation}
                disabled={generateLocationMutation.isPending}
                variant="outline"
                className="flex-1"
              >
                {generateLocationMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                Generate with AI
              </Button>
              <Button 
                onClick={handleCreateLocation}
                disabled={createLocationMutation.isPending}
                className="flex-1"
              >
                {createLocationMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <MapPin className="mr-2 h-4 w-4" />
                )}
                Create Location
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* User's Locations */}
        <Card>
          <CardHeader>
            <CardTitle>Your Locations</CardTitle>
            <CardDescription>
              Locations you've created for your campaign world
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : userLocations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No locations created yet
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {userLocations.map((location: any) => (
                  <div key={location.id} className="border rounded-lg p-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold">{location.name}</h4>
                          <Badge variant="secondary" className="text-xs">
                            {location.locationType}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {location.size}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {location.description}
                        </p>
                        {location.notableFeatures && (
                          <p className="text-xs text-muted-foreground mt-2">
                            <strong>Features:</strong> {location.notableFeatures}
                          </p>
                        )}
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