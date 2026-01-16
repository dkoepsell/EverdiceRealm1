import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Clock, Check, Plus, Sparkles, Link2, Users, Heart, HelpCircle } from "lucide-react";
import { useState } from "react";
import { apiRequest, queryClient, getQueryFn } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { UnresolvedThread } from "@shared/schema";

interface UnresolvedThreadsProps {
  campaignId: number;
}

const threadTypeIcons: Record<string, any> = {
  promise: Heart,
  tension: AlertTriangle,
  consequence: Clock,
  mystery: HelpCircle,
  relationship: Users,
};

const urgencyColors: Record<string, string> = {
  low: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  moderate: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  high: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  critical: "bg-red-500/20 text-red-400 border-red-500/30",
};

export default function UnresolvedThreads({ campaignId }: UnresolvedThreadsProps) {
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newThread, setNewThread] = useState({
    threadType: "promise",
    title: "",
    narrative: "",
    urgency: "low",
    involvedParties: "",
  });

  const { data: threads = [], isLoading } = useQuery<UnresolvedThread[]>({
    queryKey: ['/api/campaigns', campaignId, 'threads', 'active'],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !!campaignId,
  });

  const createThreadMutation = useMutation({
    mutationFn: async (threadData: any) => {
      const response = await apiRequest("POST", `/api/campaigns/${campaignId}/threads`, {
        ...threadData,
        involvedParties: threadData.involvedParties.split(",").map((s: string) => s.trim()).filter(Boolean),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns', campaignId, 'threads'] });
      setIsCreateOpen(false);
      setNewThread({ threadType: "promise", title: "", narrative: "", urgency: "low", involvedParties: "" });
      toast({
        title: "Thread Created",
        description: "The story thread has been added.",
      });
    },
  });

  const resolveThreadMutation = useMutation({
    mutationFn: async (threadId: number) => {
      const response = await apiRequest("PATCH", `/api/threads/${threadId}/resolve`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns', campaignId, 'threads'] });
      toast({
        title: "Thread Resolved",
        description: "The story thread has been marked as resolved.",
      });
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Unresolved Threads
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-muted rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-purple-500/30 bg-gradient-to-br from-purple-500/5 to-indigo-500/5">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-purple-400" />
            <span>Unresolved Threads</span>
            <Sparkles className="h-4 w-4 text-purple-400/60" />
          </CardTitle>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Add Thread
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Story Thread</DialogTitle>
                <DialogDescription>
                  Track promises, tensions, and pending consequences
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select
                    value={newThread.threadType}
                    onValueChange={(value) => setNewThread({ ...newThread, threadType: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="promise">Promise (not yet tested)</SelectItem>
                      <SelectItem value="tension">Tension (relationship strain)</SelectItem>
                      <SelectItem value="consequence">Consequence (waiting to land)</SelectItem>
                      <SelectItem value="mystery">Mystery (unresolved)</SelectItem>
                      <SelectItem value="relationship">Relationship (evolving)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input
                    placeholder="The oath to the merchant guild..."
                    value={newThread.title}
                    onChange={(e) => setNewThread({ ...newThread, title: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Narrative</Label>
                  <Textarea
                    placeholder="Describe the thread and its implications..."
                    value={newThread.narrative}
                    onChange={(e) => setNewThread({ ...newThread, narrative: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Urgency</Label>
                  <Select
                    value={newThread.urgency}
                    onValueChange={(value) => setNewThread({ ...newThread, urgency: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="moderate">Moderate</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Involved Parties (comma-separated)</Label>
                  <Input
                    placeholder="Grimshaw, The Merchant Guild, Captain Thorne..."
                    value={newThread.involvedParties}
                    onChange={(e) => setNewThread({ ...newThread, involvedParties: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={() => createThreadMutation.mutate(newThread)}
                  disabled={!newThread.title || !newThread.narrative || createThreadMutation.isPending}
                >
                  {createThreadMutation.isPending ? "Creating..." : "Add Thread"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {threads.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Link2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No unresolved threads yet</p>
            <p className="text-sm mt-1">Track promises, tensions, and pending consequences</p>
          </div>
        ) : (
          <div className="space-y-3">
            {threads.map((thread) => {
              const Icon = threadTypeIcons[thread.threadType] || Link2;
              const urgencyClass = urgencyColors[thread.urgency || "low"];
              
              return (
                <div 
                  key={thread.id} 
                  className="border border-border/50 rounded-lg p-4 hover:border-purple-500/30 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded bg-purple-500/10">
                        <Icon className="h-4 w-4 text-purple-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium">{thread.title}</h4>
                          <Badge variant="outline" className={urgencyClass}>
                            {thread.urgency}
                          </Badge>
                          <Badge variant="outline" className="capitalize">
                            {thread.threadType}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {thread.narrative}
                        </p>
                        {thread.involvedParties && thread.involvedParties.length > 0 && (
                          <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                            <Users className="h-3 w-3" />
                            {thread.involvedParties.join(", ")}
                          </div>
                        )}
                      </div>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => resolveThreadMutation.mutate(thread.id)}
                      disabled={resolveThreadMutation.isPending}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
