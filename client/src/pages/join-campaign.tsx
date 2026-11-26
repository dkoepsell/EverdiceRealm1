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
import { Input } from "@/components/ui/input";

interface PregenCard {
  key: string; name: string; race: string; className: string; background: string; alignment: string;
  pitch: string; playsLike: string; hitPoints: number; armorClass: number;
}

/** Ready-made level 3 heroes (one-shot nights): pick one and play in a minute. */
function PregenPicker({ value, onChange }: { value: string | null; onChange: (key: string) => void }) {
  const { data } = useQuery<{ pregens: PregenCard[] }>({ queryKey: ['/api/table/pregens'], staleTime: 60_000 });
  return (
    <div className="grid gap-2" role="radiogroup" aria-label="Ready-made characters" data-testid="pregen-picker">
      {(data?.pregens ?? []).map((p) => (
        <button
          key={p.key}
          type="button"
          role="radio"
          aria-checked={value === p.key}
          onClick={() => onChange(p.key)}
          className={`rounded-lg border-2 p-3 text-left transition-colors ${value === p.key ? 'border-amber-500 bg-amber-500/10' : 'border-border hover:border-amber-400'}`}
          data-testid={`pregen-${p.key}`}
        >
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-semibold">{p.name}</span>
            <span className="text-xs text-muted-foreground">{p.race} {p.className} 3 · {p.hitPoints} HP · AC {p.armorClass}</span>
          </div>
          <p className="mt-1 text-sm">{p.pitch}</p>
          <p className="mt-1 text-xs text-muted-foreground">{p.playsLike}</p>
        </button>
      ))}
    </div>
  );
}

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
  const [pregenKey, setPregenKey] = useState<string | null>(null);
  const [guestName, setGuestName] = useState("");

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

  // One-shot nights: join as a guest with a ready-made character (no account first).
  const guestJoin = useMutation({
    mutationFn: async () => {
      const g = await (await apiRequest("POST", `/api/table/guest`, { code, key: pregenKey, name: guestName })).json();
      const res = await apiRequest("POST", `/api/invitations/${code}/accept`, { characterId: g.characterId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns'] });
      toast({ title: "You're in!", description: "Your hero is ready. You can keep them later by saving an account." });
      navigate('/campaigns');
    },
    onError: (err: any) => toast({ title: "Couldn't join", description: err.message || "Something went wrong", variant: "destructive" }),
  });

  // Signed in: take a ready-made character instead of one of your own.
  const pregenJoin = useMutation({
    mutationFn: async () => {
      const c = await (await apiRequest("POST", `/api/table/pregen`, { key: pregenKey })).json();
      const res = await apiRequest("POST", `/api/invitations/${code}/accept`, { characterId: c.id });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['/api/characters'] });
      toast({ title: "You're in!", description: "The campaign is waiting for you." });
      navigate('/campaigns');
    },
    onError: (err: any) => toast({ title: "Couldn't join", description: err.message || "Something went wrong", variant: "destructive" }),
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
            <div className="space-y-4">
              <div className="space-y-3" data-testid="guest-join">
                <p className="text-sm font-medium">Play now, no account needed. Pick a ready-made hero:</p>
                <PregenPicker value={pregenKey} onChange={setPregenKey} />
                <label className="block text-sm">
                  <span className="text-muted-foreground">What should the table call you? (optional)</span>
                  <Input value={guestName} maxLength={30} onChange={(e) => setGuestName(e.target.value)} placeholder="Your name" className="mt-1" />
                </label>
                <Button
                  className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
                  disabled={!pregenKey || guestJoin.isPending}
                  onClick={() => guestJoin.mutate()}
                  data-testid="guest-join-button"
                >
                  {guestJoin.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Join as a guest
                </Button>
              </div>
              <div className="border-t pt-3 text-sm">
                <span className="text-muted-foreground">Already play Everdice? </span>
                <Button variant="link" className="h-auto p-0" onClick={() => navigate(`/auth?next=/join/${code}`)}>Sign in to use your own character</Button>
              </div>
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
          {user && (
            <details className="rounded-lg border p-3" open={availableCharacters.length === 0} data-testid="pregen-join">
              <summary className="cursor-pointer text-sm font-medium">Or play a ready-made hero</summary>
              <div className="mt-3 space-y-3">
                <PregenPicker value={pregenKey} onChange={setPregenKey} />
                <Button className="w-full" variant="outline" disabled={!pregenKey || pregenJoin.isPending} onClick={() => pregenJoin.mutate()}>
                  {pregenJoin.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Join with this hero
                </Button>
              </div>
            </details>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
