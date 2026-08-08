import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation, useSearch } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient, getQueryFn } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Scroll } from "lucide-react";

interface InvitationLookup {
  invitation: { id: number; role: string; status: string; campaignId: number };
  campaign: { id: number; title: string; description?: string; difficulty?: string };
}

interface CharacterSummary {
  id: number;
  name: string;
  race?: string;
  class?: string;
  level?: number;
  engagementKind?: string;
}

/**
 * Landing page for a shared invite link (/join/:code). The invitee — not the DM —
 * picks the character that takes the seat.
 */
export default function JoinCampaign() {
  const params = useParams<{ code?: string }>();
  const search = useSearch();
  const [, navigate] = useLocation();
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [characterId, setCharacterId] = useState<number | null>(null);

  const code = params.code || new URLSearchParams(search).get('code') || '';

  const { data: lookup, isLoading, error } = useQuery<InvitationLookup>({
    queryKey: [`/api/invitations/${code}`],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !!code,
    staleTime: 0,
  });

  const { data: characters = [] } = useQuery<CharacterSummary[]>({
    queryKey: ['/api/characters'],
    enabled: !!user,
  });

  const joinMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/invitations/${code}/accept`, { characterId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['/api/characters'] });
      toast({ title: "You're in!", description: "The campaign is waiting for you." });
      navigate('/campaigns');
    },
    onError: (err: any) => {
      toast({
        title: "Couldn't join",
        description: err.message || "Something went wrong",
        variant: "destructive",
      });
    },
  });

  const availableCharacters = characters.filter(
    c => !c.engagementKind || c.engagementKind === 'idle'
  );

  if (!code) {
    return (
      <div className="container max-w-lg py-16">
        <Card>
          <CardHeader>
            <CardTitle>No invitation code</CardTitle>
            <CardDescription>This link is missing its invitation code.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (isLoading || authLoading) {
    return (
      <div className="container max-w-lg py-16 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
      </div>
    );
  }

  if (error || !lookup) {
    return (
      <div className="container max-w-lg py-16">
        <Card>
          <CardHeader>
            <CardTitle>Invitation not found</CardTitle>
            <CardDescription>
              This invitation may have expired or already been used. Ask your DM for a fresh one.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-lg py-16">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scroll className="h-5 w-5 text-amber-400" />
            {lookup.campaign.title}
          </CardTitle>
          <CardDescription>
            You've been invited to join as a{' '}
            <Badge variant="outline" className="capitalize">{lookup.invitation.role || 'player'}</Badge>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {lookup.campaign.description && (
            <p className="text-sm text-muted-foreground">{lookup.campaign.description}</p>
          )}

          {!user ? (
            <div className="space-y-3">
              <p className="text-sm">Sign in to accept this invitation.</p>
              <Button onClick={() => navigate(`/auth?next=/join/${code}`)}>Sign in</Button>
            </div>
          ) : availableCharacters.length === 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {characters.length > 0
                  ? "All of your characters are busy in other adventures."
                  : "You'll need a character before you can join."}
              </p>
              <Button variant="outline" onClick={() => navigate('/characters')}>
                Go to characters
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <label className="text-sm font-medium">Play as</label>
              <Select onValueChange={(value) => setCharacterId(Number(value))}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a character" />
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
              <Button
                className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
                disabled={!characterId || joinMutation.isPending}
                onClick={() => joinMutation.mutate()}
              >
                {joinMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Join the campaign
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
