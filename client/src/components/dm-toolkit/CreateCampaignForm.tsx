import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";

interface CreateCampaignFormProps {
  onSuccess: (campaignId: number) => void;
}

export default function CreateCampaignForm({ onSuccess }: CreateCampaignFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [difficulty, setDifficulty] = useState("Normal");
  const [narrativeStyle, setNarrativeStyle] = useState("descriptive");
  
  const { toast } = useToast();

  const createCampaignMutation = useMutation({
    mutationFn: async (campaignData: any) => {
      return apiRequest('/api/campaigns', {
        method: 'POST',
        body: JSON.stringify(campaignData)
      });
    },
    onSuccess: (data: any) => {
      toast({
        title: "Campaign Created",
        description: `${title} has been created successfully!`
      });
      onSuccess(data.id);
    },
    onError: (error: any) => {
      toast({
        title: "Creation Failed",
        description: error.message || "Failed to create campaign",
        variant: "destructive"
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) {
      toast({
        title: "Title Required",
        description: "Please enter a campaign title",
        variant: "destructive"
      });
      return;
    }

    createCampaignMutation.mutate({
      title: title.trim(),
      description: description.trim(),
      difficulty,
      narrativeStyle,
      isActive: true
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">Campaign Title</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Enter campaign name..."
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description (Optional)</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Brief campaign description..."
          rows={3}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="difficulty">Difficulty</Label>
          <Select value={difficulty} onValueChange={setDifficulty}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Easy">Easy</SelectItem>
              <SelectItem value="Normal">Normal</SelectItem>
              <SelectItem value="Hard">Hard</SelectItem>
              <SelectItem value="Deadly">Deadly</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="style">Narrative Style</Label>
          <Select value={narrativeStyle} onValueChange={setNarrativeStyle}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="descriptive">Descriptive</SelectItem>
              <SelectItem value="action-packed">Action-Packed</SelectItem>
              <SelectItem value="atmospheric">Atmospheric</SelectItem>
              <SelectItem value="humorous">Humorous</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex justify-end space-x-2 pt-4">
        <Button
          type="submit"
          disabled={createCampaignMutation.isPending || !title.trim()}
        >
          {createCampaignMutation.isPending && (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          )}
          Create Campaign
        </Button>
      </div>
    </form>
  );
}