import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient, getQueryFn } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Mail, Check, X, Users, Shield, Loader2 } from "lucide-react";

interface EnrichedInvitation {
  id: number;
  groupId: number;
  inviterId: number;
  inviteeId: number;
  status: string;
  message?: string;
  createdAt?: string;
  groupName?: string;
  groupType?: string;
  inviterName?: string;
}

export default function InvitationAlert() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [hasShownInitial, setHasShownInitial] = useState(false);

  const { data: pendingInvitations = [] } = useQuery<EnrichedInvitation[]>({
    queryKey: ['/api/invitations/pending'],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !!user,
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (pendingInvitations.length > 0 && !hasShownInitial && user) {
      setIsOpen(true);
      setHasShownInitial(true);
    }
  }, [pendingInvitations, hasShownInitial, user]);

  useEffect(() => {
    if (!user) {
      setHasShownInitial(false);
    }
  }, [user]);

  const acceptMutation = useMutation({
    mutationFn: async (invitationId: number) => {
      const response = await apiRequest("POST", `/api/group-invitations/${invitationId}/accept`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/invitations/pending'] });
      queryClient.invalidateQueries({ queryKey: ['/api/groups'] });
      toast({
        title: "Invitation Accepted!",
        description: "You have joined the group.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to accept",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    },
  });

  const declineMutation = useMutation({
    mutationFn: async (invitationId: number) => {
      const response = await apiRequest("POST", `/api/group-invitations/${invitationId}/decline`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/invitations/pending'] });
      toast({
        title: "Invitation Declined",
        description: "The invitation has been declined.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to decline",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    },
  });

  if (!user || pendingInvitations.length === 0) {
    return null;
  }

  const getGroupIcon = (type: string) => {
    switch (type) {
      case 'guild':
        return <Shield className="h-5 w-5 text-amber-400" />;
      default:
        return <Users className="h-5 w-5 text-blue-400" />;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-amber-400" />
            You Have {pendingInvitations.length} Invitation{pendingInvitations.length > 1 ? 's' : ''}!
          </DialogTitle>
          <DialogDescription>
            Someone has invited you to join their group. Would you like to accept?
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[300px] pr-4">
          <div className="space-y-3">
            {pendingInvitations.map((inv) => (
              <div 
                key={inv.id} 
                className="p-4 border rounded-lg bg-gradient-to-br from-amber-500/5 to-orange-500/5 border-amber-500/20"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/10">
                    {getGroupIcon(inv.groupType || 'party')}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold">{inv.groupName || 'Unknown Group'}</h4>
                      <Badge variant="outline" className="capitalize text-xs">
                        {inv.groupType || 'party'}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Invited by <span className="font-medium text-foreground">{inv.inviterName || 'Unknown'}</span>
                    </p>
                    {inv.message && (
                      <p className="text-sm italic mt-2 text-muted-foreground">"{inv.message}"</p>
                    )}
                  </div>
                </div>
                
                <div className="flex gap-2 mt-3 justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => declineMutation.mutate(inv.id)}
                    disabled={declineMutation.isPending || acceptMutation.isPending}
                  >
                    {declineMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <X className="h-4 w-4 mr-1" />
                    )}
                    Decline
                  </Button>
                  <Button
                    size="sm"
                    className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
                    onClick={() => acceptMutation.mutate(inv.id)}
                    disabled={acceptMutation.isPending || declineMutation.isPending}
                  >
                    {acceptMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : (
                      <Check className="h-4 w-4 mr-1" />
                    )}
                    Accept
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setIsOpen(false)}>
            Decide Later
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
