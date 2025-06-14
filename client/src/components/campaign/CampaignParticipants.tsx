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
import { ChevronsUpDown, Shield, User, UserPlus, X, Users } from 'lucide-react';
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
    };
  }

  // Fetch participants
  const { data: participants = [], isLoading: isLoadingParticipants } = useQuery<ExtendedParticipant[]>({
    queryKey: [`/api/campaigns/${campaignId}/participants`],
    enabled: !!campaignId
  });
  
  // Fetch campaign NPCs
  const { data: campaignNpcs = [], isLoading: isLoadingNpcs } = useQuery({
    queryKey: [`/api/campaigns/${campaignId}/npcs`],
    enabled: !!campaignId
  });
  
  // Combine participants and NPCs for display
  const allParticipants = [...participants];
  
  // Transform NPCs into participant format for display
  if (Array.isArray(campaignNpcs) && campaignNpcs.length > 0) {
    campaignNpcs.forEach((campaignNpc: any) => {
      allParticipants.push({
        id: campaignNpc.id, // This is the campaignNpc id
        campaignId: campaignId,
        userId: 0, // Placeholder for NPCs
        characterId: 0, // Placeholder for NPCs
        role: campaignNpc.role || 'companion',
        turnOrder: null,
        isActive: true,
        joinedAt: campaignNpc.joinedAt || new Date().toISOString(),
        lastActiveAt: null,
        username: 'NPC',
        displayName: null,
        character: {} as Character, // Empty character object
        isNpc: true,
        npc: {
          id: campaignNpc.npcId,
          name: campaignNpc.npc?.name || 'Companion',
          race: campaignNpc.npc?.race || 'Unknown',
          occupation: campaignNpc.npc?.occupation || 'Companion',
          level: campaignNpc.npc?.level || 1
        }
      });
    });
  }
  
  const isLoading = isLoadingParticipants || isLoadingNpcs;

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
      // Invalidate both participants and NPCs to refresh the complete list
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/participants`] });
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/npcs`] });
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

  if (isLoading) {
    return <div className="flex items-center justify-center p-8">Loading participants...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-black">Campaign Participants</h3>
        
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
                <SelectTrigger className="bg-primary text-primary-foreground border-0 hover:bg-primary/90 h-9 text-black">
                  <SelectValue placeholder="Add One of My Characters" />
                </SelectTrigger>
                <SelectContent className="min-w-[240px]">
                    <div className="p-1">
                      <div className="py-1.5 pl-8 pr-2 text-sm font-semibold text-black">My Characters</div>
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
                    <label htmlFor="user" className="text-sm font-medium text-black">User</label>
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
                    <label htmlFor="character" className="text-sm font-medium text-black">Character</label>
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
        {allParticipants?.map((participant: ExtendedParticipant) => (
          <Card key={participant.id} className={participant.isActive ? "" : "opacity-60"}>
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <div className="flex items-center space-x-2">
                  <Avatar>
                    {participant.character?.portraitUrl ? (
                      <AvatarImage src={participant.character.portraitUrl} alt={participant.character.name} />
                    ) : (
                      <AvatarFallback>
                        {participant.isNpc 
                          ? participant.npc?.name?.[0] || 'N'
                          : participant.displayName?.[0] || participant.username?.[0] || 'U'
                        }
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <div>
                    {participant.isNpc ? (
                      <CardTitle className="text-sm font-semibold text-black">
                        {participant.npc?.name || 'NPC Companion'}
                      </CardTitle>
                    ) : (
                      <CardTitle className="text-sm font-semibold text-black">
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
                  isDM && (
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
                  )
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
                <p className="font-semibold text-black">{participant.character?.name}</p>
                <p className="text-gray-700 text-xs">
                  Level {participant.character?.level || 1} {participant.character?.race} {participant.character?.class}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      {participants?.length === 0 && (
        <div className="text-center p-8 border-2 border-dashed rounded-lg">
          <p className="text-black font-medium mb-2 text-lg">No participants in this campaign yet.</p>
          {isDM && <p className="text-black font-medium">Use the Invite button to add players.</p>}
        </div>
      )}
    </div>
  );
}