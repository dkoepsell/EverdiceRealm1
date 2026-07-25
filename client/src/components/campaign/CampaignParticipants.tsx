import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ChevronsUpDown, Shield, User, UserPlus, X, Users, Sword, Heart, ImageIcon, Loader2, Sparkles, Wand2 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Character, User as UserType } from '@shared/schema';

interface CampaignParticipant {
  id: number;
  campaignId: number;
  userId: number;
  characterId: number;
  role: string;
  turnOrder: number | null;
  isActive: boolean;
  joinedAt: string;
  lastActiveAt: string | null;
  username: string;
  displayName: string | null;
  character: Character;
}

interface CampaignParticipantsProps {
  campaignId: number;
  isDM: boolean;
}

export default function CampaignParticipants({ campaignId, isDM }: CampaignParticipantsProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [selectedCharacterId, setSelectedCharacterId] = useState<number | null>(null);
  
  // Extended participant interface for NPCs
  interface ExtendedParticipant extends CampaignParticipant {
    isNpc?: boolean;
    npc?: {
      id: number;
      name: string;
      race: string;
      occupation: string;
      level?: number;
      portraitUrl?: string | null;
    };
  }
  
  const [generatingPortraitFor, setGeneratingPortraitFor] = useState<number | null>(null);
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);
  const [genRace, setGenRace] = useState('any');
  const [genClass, setGenClass] = useState('any');
  const [genType, setGenType] = useState('any');
  const [genPersonality, setGenPersonality] = useState('any');

  // Generation and joining are now two steps. Playtest feedback asked for
  // "some explicit way of having a companion join" — previously the generate
  // call created the NPC and added them to the party in one shot, so a reroll
  // wasn't possible and nobody ever agreed to anything.
  const [candidate, setCandidate] = useState<any | null>(null);

  const generateCompanionMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/ai-generate/npc', {
        race: genRace,
        npcClass: genClass,
        companionType: genType,
        personalityArchetype: genPersonality,
        campaignId: campaignId.toString(),
      });
      return res.json();
    },
    onSuccess: (data) => {
      setCandidate(data);
      toast({
        title: `${data.name} awaits your answer`,
        description: `${data.race} ${data.occupation} — ${data.personality}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to generate companion',
        description: error.message || 'Something went wrong',
        variant: 'destructive',
      });
    },
  });

  const recruitCompanionMutation = useMutation({
    mutationFn: async (npcId: number) => {
      const res = await apiRequest('POST', `/api/campaigns/${campaignId}/companions/${npcId}/recruit`);
      return res.json();
    },
    onSuccess: (_data, npcId) => {
      const name = candidate?.name ?? 'Your companion';
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/participants`] });
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/npcs`] });
      setCandidate(null);
      setIsGenerateOpen(false);
      setGenRace('any');
      setGenClass('any');
      setGenType('any');
      setGenPersonality('any');
      toast({ title: `${name} has joined the party!` });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to recruit companion',
        description: error.message || 'Something went wrong',
        variant: 'destructive',
      });
    },
  });

  // Fetch participants (backend already includes NPCs in the response)
  const { data: participants = [], isLoading } = useQuery<ExtendedParticipant[]>({
    queryKey: [`/api/campaigns/${campaignId}/participants`],
    enabled: !!campaignId
  });
  
  // The backend already combines participants and NPCs, so we use participants directly
  const allParticipants = participants;

  // Fetch all users
  const { data: users = [] } = useQuery<UserType[]>({
    queryKey: ['/api/users'],
    enabled: isDM && isInviteDialogOpen
  });

  // Fetch characters for selected user
  const { data: userCharacters = [] } = useQuery<Character[]>({
    queryKey: ['/api/characters', selectedUserId],
    enabled: !!selectedUserId && isInviteDialogOpen
  });
  
  // Fetch current user's characters for dropdown
  const { data: myCharacters = [] } = useQuery<Character[]>({
    queryKey: ['/api/characters'],
    enabled: !!user
  });

  // Add participant mutation
  const addParticipantMutation = useMutation({
    mutationFn: async (data: { userId: number; characterId: number; role: string }) => {
      const res = await apiRequest(
        'POST', 
        `/api/campaigns/${campaignId}/participants`, 
        data
      );
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/participants`] });
      setIsInviteDialogOpen(false);
      toast({
        title: 'Participant added',
        description: 'The user has been added to the campaign'
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to add participant',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  // Remove participant mutation
  const removeParticipantMutation = useMutation({
    mutationFn: async (userId: number) => {
      await apiRequest(
        'DELETE', 
        `/api/campaigns/${campaignId}/participants/${userId}`
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/participants`] });
      toast({
        title: 'Participant removed',
        description: 'The user has been removed from the campaign'
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to remove participant',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  const handleAddParticipant = () => {
    if (!selectedUserId || !selectedCharacterId) {
      toast({
        title: 'Missing information',
        description: 'Please select a user and character',
        variant: 'destructive'
      });
      return;
    }

    addParticipantMutation.mutate({
      userId: selectedUserId,
      characterId: selectedCharacterId,
      role: 'player'
    });
  };

  // Add remove NPC mutation
  const removeNpcMutation = useMutation({
    mutationFn: async ({ campaignId, npcId }: { campaignId: number; npcId: number }) => {
      await apiRequest(
        'DELETE', 
        `/api/campaigns/${campaignId}/npcs/${npcId}`
      );
    },
    onSuccess: () => {
      // Invalidate participants to refresh the list (backend includes NPCs in participants response)
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/participants`] });
      toast({
        title: 'Companion removed',
        description: 'The companion has been removed from the campaign'
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to remove companion',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  const handleRemoveParticipant = (userId: number) => {
    if (confirm('Are you sure you want to remove this participant?')) {
      removeParticipantMutation.mutate(userId);
    }
  };

  const handleRemoveNpc = (campaignId: number, npcId: number) => {
    if (confirm('Are you sure you want to remove this NPC companion?')) {
      removeNpcMutation.mutate({ campaignId, npcId });
    }
  };

  const generateNpcPortraitMutation = useMutation({
    mutationFn: async (npcId: number) => {
      setGeneratingPortraitFor(npcId);
      const response = await apiRequest('POST', `/api/npcs/${npcId}/generate-portrait`);
      const data = await response.json();
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/participants`] });
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/npcs`] });
      setGeneratingPortraitFor(null);
      toast({
        title: 'Portrait generated!',
        description: 'The companion now has a portrait'
      });
    },
    onError: (error: Error) => {
      setGeneratingPortraitFor(null);
      toast({
        title: 'Failed to generate portrait',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  if (isLoading) {
    return <div className="flex items-center justify-center p-8">Loading participants...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold" style={{ color: '#0f172a' }}>Campaign Participants</h3>
        
        <div className="flex gap-2">
          {/* Join Campaign Button - Only show if user is not already participating */}
          {user && !participants?.find((p: CampaignParticipant) => p.userId === user.id) && (
            <div className="relative group">
              <Select 
                onValueChange={(value) => {
                  if (value === "no-characters") return;
                  
                  const characterId = Number(value);
                  if (isNaN(characterId)) {
                    toast({
                      title: "Invalid character selection",
                      description: "Please select a valid character",
                      variant: "destructive",
                    });
                    return;
                  }
                  
                  if (characterId && user) {
                    // Call mutation directly instead of setting state and using handleAddParticipant
                    addParticipantMutation.mutate({
                      userId: user.id,
                      characterId: characterId,
                      role: 'player'
                    });
                  } else {
                    toast({
                      title: "Missing information",
                      description: "User information or character ID is missing",
                      variant: "destructive",
                    });
                  }
                }}
              >
                <SelectTrigger className="bg-primary text-primary-foreground border-0 hover:bg-primary/90 h-9">
                  <SelectValue placeholder="Add One of My Characters" />
                </SelectTrigger>
                <SelectContent className="min-w-[240px]">
                    <div className="p-1">
                      <div className="py-1.5 pl-8 pr-2 text-sm font-semibold text-slate-900 dark:text-slate-100">My Characters</div>
                    {/* Display the user's characters */}
                    {myCharacters && myCharacters.length > 0 ? (
                      myCharacters.map(character => (
                        <SelectItem 
                          key={character.id} 
                          value={character.id.toString()} 
                          className="py-2"
                        >
                          <div className="flex items-center gap-2">
                            <div className="bg-secondary-light rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                              {character.class.charAt(0)}
                            </div>
                            <span className="font-medium">{character.name}</span>
                            <span className="text-xs text-gray-700">
                              Lvl {character.level} {character.race} {character.class}
                            </span>
                          </div>
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="no-characters" disabled className="py-2 italic text-gray-500">
                        No characters available
                      </SelectItem>
                    )}
                    </div>
                </SelectContent>
              </Select>
            </div>
          )}
          
          {/* Generate Companion Button - Only visible to DM */}
          {isDM && (
            <Dialog open={isGenerateOpen} onOpenChange={setIsGenerateOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white">
                  <Wand2 className="h-4 w-4 mr-2" />
                  Generate Companion
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-purple-400" />
                    Generate NPC Companion
                  </DialogTitle>
                  <DialogDescription>
                    Choose traits below or leave as "Surprise me" for a fully random companion.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="space-y-1.5">
                    <Label>Race</Label>
                    <Select value={genRace} onValueChange={setGenRace}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">Surprise me</SelectItem>
                        <SelectItem value="Human">Human</SelectItem>
                        <SelectItem value="Elf">Elf</SelectItem>
                        <SelectItem value="Dwarf">Dwarf</SelectItem>
                        <SelectItem value="Halfling">Halfling</SelectItem>
                        <SelectItem value="Half-Orc">Half-Orc</SelectItem>
                        <SelectItem value="Tiefling">Tiefling</SelectItem>
                        <SelectItem value="Dragonborn">Dragonborn</SelectItem>
                        <SelectItem value="Gnome">Gnome</SelectItem>
                        <SelectItem value="Half-Elf">Half-Elf</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Class</Label>
                    <Select value={genClass} onValueChange={setGenClass}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">Surprise me</SelectItem>
                        <SelectItem value="Fighter">Fighter</SelectItem>
                        <SelectItem value="Wizard">Wizard</SelectItem>
                        <SelectItem value="Rogue">Rogue</SelectItem>
                        <SelectItem value="Cleric">Cleric</SelectItem>
                        <SelectItem value="Ranger">Ranger</SelectItem>
                        <SelectItem value="Paladin">Paladin</SelectItem>
                        <SelectItem value="Barbarian">Barbarian</SelectItem>
                        <SelectItem value="Bard">Bard</SelectItem>
                        <SelectItem value="Druid">Druid</SelectItem>
                        <SelectItem value="Monk">Monk</SelectItem>
                        <SelectItem value="Sorcerer">Sorcerer</SelectItem>
                        <SelectItem value="Warlock">Warlock</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Party Role</Label>
                    <Select value={genType} onValueChange={setGenType}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">Surprise me</SelectItem>
                        <SelectItem value="combat">Combat — frontline fighter or damage dealer</SelectItem>
                        <SelectItem value="support">Support — healer or buffer</SelectItem>
                        <SelectItem value="utility">Utility — scout, traps, lockpicking</SelectItem>
                        <SelectItem value="social">Social — diplomat, negotiator, face of the party</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Personality</Label>
                    <Select value={genPersonality} onValueChange={setGenPersonality}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">Surprise me</SelectItem>
                        <SelectItem value="stoic and honorable">Stoic and Honorable</SelectItem>
                        <SelectItem value="cheerful and optimistic">Cheerful and Optimistic</SelectItem>
                        <SelectItem value="cynical and world-weary">Cynical and World-Weary</SelectItem>
                        <SelectItem value="mysterious and secretive">Mysterious and Secretive</SelectItem>
                        <SelectItem value="hot-headed and impulsive">Hot-Headed and Impulsive</SelectItem>
                        <SelectItem value="scholarly and curious">Scholarly and Curious</SelectItem>
                        <SelectItem value="roguish and charming">Roguish and Charming</SelectItem>
                        <SelectItem value="gruff but kind-hearted">Gruff but Kind-Hearted</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {/* Step 2: meet them, then decide. */}
                {candidate && (
                  <div className="rounded-lg border border-purple-500/40 bg-purple-500/5 p-4 mt-2" data-testid="companion-candidate">
                    <div className="flex items-baseline justify-between flex-wrap gap-2">
                      <h4 className="text-lg font-semibold">{candidate.name}</h4>
                      <span className="text-sm text-muted-foreground">
                        {candidate.race} {candidate.occupation}
                      </span>
                    </div>
                    {candidate.personality && (
                      <p className="text-sm text-muted-foreground mt-1">{candidate.personality}</p>
                    )}
                    {candidate.backstory && (
                      <p className="text-sm mt-2 line-clamp-4">{candidate.backstory}</p>
                    )}
                  </div>
                )}

                <DialogFooter className="gap-2 sm:gap-2">
                  {candidate ? (
                    <>
                      <Button
                        onClick={() => recruitCompanionMutation.mutate(candidate.id)}
                        disabled={recruitCompanionMutation.isPending}
                        className="w-full sm:w-auto bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
                        data-testid="button-recruit-companion"
                      >
                        {recruitCompanionMutation.isPending ? (
                          <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Welcoming...</>
                        ) : (
                          <><UserPlus className="h-4 w-4 mr-2" /> Recruit {candidate.name}</>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => generateCompanionMutation.mutate()}
                        disabled={generateCompanionMutation.isPending || recruitCompanionMutation.isPending}
                        data-testid="button-reroll-companion"
                      >
                        {generateCompanionMutation.isPending ? (
                          <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Conjuring...</>
                        ) : (
                          <><Wand2 className="h-4 w-4 mr-2" /> Someone else</>
                        )}
                      </Button>
                      <Button variant="ghost" onClick={() => setCandidate(null)}>
                        Not now
                      </Button>
                    </>
                  ) : (
                    <Button
                      onClick={() => generateCompanionMutation.mutate()}
                      disabled={generateCompanionMutation.isPending}
                      className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
                    >
                      {generateCompanionMutation.isPending ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Conjuring companion...</>
                      ) : (
                        <><Wand2 className="h-4 w-4 mr-2" /> Generate Companion</>
                      )}
                    </Button>
                  )}
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}

          {/* Invite Button - Only visible to DM */}
          {isDM && (
            <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Invite
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Participant</DialogTitle>
                  <DialogDescription>
                    Invite a user to join your campaign with a character.
                  </DialogDescription>
                </DialogHeader>
                
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <label htmlFor="user" className="text-sm font-medium text-slate-900 dark:text-slate-100">User</label>
                    <Select 
                      onValueChange={(value) => setSelectedUserId(Number(value))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select user" />
                      </SelectTrigger>
                      <SelectContent>
                        {users?.map(user => (
                          <SelectItem key={user.id} value={user.id.toString()}>
                            {user.displayName || user.username}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <label htmlFor="character" className="text-sm font-medium text-slate-900 dark:text-slate-100">Character</label>
                    <Select
                      onValueChange={(value) => setSelectedCharacterId(Number(value))}
                      disabled={!selectedUserId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={!selectedUserId ? "Select user first" : "Select character"} />
                      </SelectTrigger>
                      <SelectContent>
                        {userCharacters?.map(character => (
                          <SelectItem key={character.id} value={character.id.toString()}>
                            {character.name} ({character.race} {character.class})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <DialogFooter>
                  <Button 
                    onClick={handleAddParticipant} 
                    disabled={!selectedUserId || !selectedCharacterId || addParticipantMutation.isPending}
                  >
                    {addParticipantMutation.isPending ? 'Adding...' : 'Add to Campaign'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {allParticipants?.map((participant: ExtendedParticipant, index: number) => (
          <Card key={participant.isNpc ? `npc-${participant.npc?.id}-${index}` : `player-${participant.id}-${index}`} className={participant.isActive ? "" : "opacity-60"}>
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <div className="flex items-center space-x-2">
                  <Avatar>
                    {participant.isNpc ? (
                      participant.npc?.portraitUrl ? (
                        <AvatarImage src={participant.npc.portraitUrl} alt={participant.npc.name} />
                      ) : (
                        <AvatarFallback>
                          {participant.npc?.name?.[0] || 'N'}
                        </AvatarFallback>
                      )
                    ) : participant.character?.portraitUrl ? (
                      <AvatarImage src={participant.character.portraitUrl} alt={participant.character.name} />
                    ) : (
                      <AvatarFallback>
                        {participant.displayName?.[0] || participant.username?.[0] || 'U'}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <div>
                    {participant.isNpc ? (
                      <CardTitle className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {participant.npc?.name || 'NPC Companion'}
                      </CardTitle>
                    ) : (
                      <CardTitle className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {participant.displayName || participant.username}
                      </CardTitle>
                    )}
                    <CardDescription className="text-xs text-gray-700">
                      {participant.role === 'dm' ? (
                        <Badge variant="secondary" className="mr-1 font-medium">
                          <Shield className="h-3 w-3 mr-1" /> DM
                        </Badge>
                      ) : participant.isNpc ? (
                        <Badge variant="outline" className="mr-1 font-medium text-emerald-600">
                          <Users className="h-3 w-3 mr-1" /> Companion
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="mr-1 font-medium text-gray-800">
                          <User className="h-3 w-3 mr-1" /> Player
                        </Badge>
                      )}
                      {!participant.isNpc && participant.turnOrder && (
                        <Badge variant="outline" className="font-medium text-gray-800">
                          <ChevronsUpDown className="h-3 w-3 mr-1" />
                          Turn {participant.turnOrder}
                        </Badge>
                      )}
                    </CardDescription>
                  </div>
                </div>
                
                {participant.isNpc ? (
                  // For NPCs
                  <div className="flex gap-1">
                    {!participant.npc?.portraitUrl && participant.npc?.id && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => generateNpcPortraitMutation.mutate(participant.npc!.id)}
                              disabled={generatingPortraitFor === participant.npc.id}
                            >
                              {generatingPortraitFor === participant.npc.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <ImageIcon className="h-4 w-4" />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Generate portrait</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    {isDM && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => handleRemoveNpc(campaignId, participant.npc?.id || 0)}
                              disabled={removeNpcMutation.isPending}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Remove companion</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                ) : (
                  // For player characters
                  (isDM || user?.id === participant.userId) && participant.role !== 'dm' && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6" 
                            onClick={() => handleRemoveParticipant(participant.userId)}
                            disabled={removeParticipantMutation.isPending}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Remove participant</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )
                )}
              </div>
            </CardHeader>
            
            <CardContent className="pt-0">
              <div className="text-sm">
                <p className="font-semibold text-slate-900 dark:text-slate-100">{participant.isNpc ? participant.npc?.name : participant.character?.name}</p>
                <p className="text-gray-700 text-xs">
                  Level {participant.isNpc ? (participant.npc?.level || 1) : (participant.character?.level || 1)} {participant.isNpc ? participant.npc?.race : participant.character?.race} {participant.isNpc ? participant.npc?.occupation : participant.character?.class}
                </p>
                
                {/* Combat Stats - HP, Weapon, AC for Players */}
                {!participant.isNpc && participant.character && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {/* HP Display */}
                    <div className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                      (participant.character.hitPoints || 0) <= 0 
                        ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300' 
                        : (participant.character.hitPoints || 0) < (participant.character.maxHitPoints || 1) / 2
                          ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300'
                          : 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300'
                    }`}>
                      <Heart className="h-3 w-3" />
                      {participant.character.hitPoints || 0}/{participant.character.maxHitPoints || 0}
                    </div>
                    
                    {/* Equipped Weapon */}
                    {participant.character.equipment && participant.character.equipment.length > 0 && (
                      <div className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
                        <Sword className="h-3 w-3" />
                        {(() => {
                          const item = participant.character.equipment[0];
                          if (typeof item === 'object' && item !== null) {
                            return (item as any).name || 'Unknown';
                          }
                          try {
                            const parsed = JSON.parse(item as string);
                            return parsed.name || item;
                          } catch {
                            return item;
                          }
                        })()}
                      </div>
                    )}
                    
                    {/* Armor Class */}
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                      <Shield className="h-3 w-3" />
                      AC {participant.character.armorClass || 10}
                    </div>
                  </div>
                )}
                
                {/* Combat Stats - HP, Weapon, AC for NPC Companions */}
                {participant.isNpc && participant.character && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {/* HP Display */}
                    <div className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                      (participant.character.hitPoints || 0) <= 0 
                        ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300' 
                        : (participant.character.hitPoints || 0) < (participant.character.maxHitPoints || 1) / 2
                          ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300'
                          : 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300'
                    }`}>
                      <Heart className="h-3 w-3" />
                      {participant.character.hitPoints || 0}/{participant.character.maxHitPoints || 0}
                    </div>
                    
                    {/* Equipped Weapon for NPC */}
                    {(participant as any).npc?.equippedWeapon && (
                      <div className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
                        <Sword className="h-3 w-3" />
                        {(() => {
                          try {
                            const weapon = JSON.parse((participant as any).npc.equippedWeapon);
                            return weapon.name || (participant as any).npc.equippedWeapon;
                          } catch {
                            return (participant as any).npc.equippedWeapon;
                          }
                        })()}
                      </div>
                    )}
                    
                    {/* Armor Class */}
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                      <Shield className="h-3 w-3" />
                      AC {participant.character.armorClass || (participant as any).npc?.armorClass || 10}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      {participants?.length === 0 && (
        <div className="text-center p-8 border-2 border-dashed border-amber-300 rounded-lg bg-white/60">
          <Users className="h-12 w-12 text-amber-400 mx-auto mb-3" />
          <p className="text-slate-700 font-medium mb-2 text-lg">No participants in this campaign yet.</p>
          {isDM && <p className="text-slate-600">Use the Invite button to add players.</p>}
        </div>
      )}
    </div>
  );
}