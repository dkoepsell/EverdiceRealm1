import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Scroll, Check, X, Loader2 } from "lucide-react";

interface CampaignInvitation {
  id: number;
  campaignId: number;
  role: string;
  status: string;
  notes?: string | null;
  campaignTitle: string;
  campaignDescription?: string | null;
  campaignDifficulty?: string | null;
  inviterName: string;
}

interface CharacterSummary {
  id: number;
  name: string;
  race?: string;
  class?: string;
  level?: number;
  engagementKind?: string;
  engagementId?: number | null;
}

/**
 * Campaign invitations are addressed to a player, not to a character — the player
 * decides who they bring. This is the notice they get, with accept/decline.
 */
export default function CampaignInvitationAlert() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [hasShownInitial, setHasShownInitial] = useState(false);
  const [chosenCharacter, setChosenCharacter] = useState<Record<number, number>>({});

  const { data: invitations = [] } = useQuery<CampaignInvitation[]>({
    queryKey: ['/api/campaign-invitations/pending'],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !!user,
    // The global default is staleTime: Infinity — an invite that arrives mid-session
    // would never show up without these.
    staleTime: 0,
    refetchInterval: 60000,
  });

  const { data: characters = [] } = useQuery<CharacterSummary[]>({
    queryKey: ['/api/characters'],
    enabled: !!user && invitations.length > 0,
  });

  useEffect(() => {
    if (invitations.length > 0 && !hasShownInitial && user) {
      setIsOpen(true);
      setHasShownInitial(true);
    }
  }, [invitations, hasShownInitial, user]);

  useEffect(() => {
    if (!user) {
      setHasShownInitial(false);
    }
  }, [user]);

  const acceptMutation = useMutation({
    mutationFn: async ({ invitationId, characterId }: { invitationId: number; characterId: number }) => {
      const response = await apiRequest("POST", `/api/campaign-invitations/${invitationId}/accept`, { characterId });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/campaign-invitations/pending'] });
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['/api/characters'] });
      toast({
        title: "You're in!",
        description: "The campaign is waiting for you.",
      });
      if (invitations.length <= 1) setIsOpen(false);
      navigate('/campaigns');
    },
    onError: (error: any) => {
      toast({
        title: "Couldn't join",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    },
  });

  const declineMutation = useMutation({
    mutationFn: async (invitationId: number) => {
      const response = await apiRequest("POST", `/api/campaign-invitations/${invitationId}/decline`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/campaign-invitations/pending'] });
      toast({
        title: "Invitation declined",
        description: "The DM can always invite you again.",
      });
      if (invitations.length <= 1) setIsOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to decline",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    },
  });

  if (!user || invitations.length === 0) {
    return null;
  }

  // A character already off in another campaign or run can't take a second seat
  const availableCharacters = characters.filter(
    c => !c.engagementKind || c.engagementKind === 'idle'
  );

  const busy = acceptMutation.isPending || declineMutation.isPending;

  return (
    <>
      {/* Dismissing the dialog shouldn't bury the invitation */}
      {!isOpen && (
        <Button
          size="sm"
          onClick={() => setIsOpen(true)}
          className="fixed bottom-4 right-4 z-40 shadow-lg bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
        >
          <Scroll className="h-4 w-4 mr-1" />
          {invitations.length > 1
            ? `${invitations.length} campaign invitations`
            : 'Campaign invitation'}
        </Button>
      )}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scroll className="h-5 w-5 text-amber-400" />
            {invitations.length > 1
              ? `${invitations.length} Campaign Invitations`
              : 'A Campaign Invitation'}
          </DialogTitle>
          <DialogDescription>
            Choose which of your characters you'd like to play, then accept.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[360px] pr-4">
          <div className="space-y-3">
            {invitations.map((inv) => (
              <div
                key={inv.id}
                className="p-4 border rounded-lg bg-gradient-to-br from-amber-500/5 to-orange-500/5 border-amber-500/20"
              >
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-semibold">{inv.campaignTitle}</h4>
                  <Badge variant="outline" className="capitalize text-xs">
                    {inv.role || 'player'}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Invited by <span className="font-medium text-foreground">{inv.inviterName}</span>
                </p>
                {inv.notes && (
                  <p className="text-sm italic mt-2 text-muted-foreground">"{inv.notes}"</p>
                )}

                <div className="mt-3">
                  {availableCharacters.length > 0 ? (
                    <Select
                      value={chosenCharacter[inv.id]?.toString()}
                      onValueChange={(value) =>
                        setChosenCharacter(prev => ({ ...prev, [inv.id]: Number(value) }))
                      }
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Play as..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableCharacters.map(character => (
                          <SelectItem key={character.id} value={character.id.toString()}>
                            {character.name}
                            {character.level ? ` — Level ${character.level}` : ''}
                            {character.race ? ` ${character.race}` : ''}
                            {character.class ? ` ${character.class}` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      {characters.length > 0
                        ? "All of your characters are busy in other adventures."
                        : "You'll need a character first."}
                      <Button
                        variant="link"
                        className="h-auto p-0 ml-1 text-amber-500"
                        onClick={() => { setIsOpen(false); navigate('/characters'); }}
                      >
                        Go to characters
                      </Button>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 mt-3 justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => declineMutation.mutate(inv.id)}
                    disabled={busy}
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
                    onClick={() => acceptMutation.mutate({
                      invitationId: inv.id,
                      characterId: chosenCharacter[inv.id],
                    })}
                    disabled={busy || !chosenCharacter[inv.id]}
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
    </>
  );
}
