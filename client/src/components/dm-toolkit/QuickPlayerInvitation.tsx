import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Users,
  Link,
  Copy,
  Send,
  UserPlus,
  Clock,
  Share2,
  QrCode,
  Mail,
  MessageCircle,
  Loader2,
  CheckCircle,
  ExternalLink,
} from "lucide-react";

interface QuickPlayerInvitationProps {
  campaignId: number;
  campaignTitle: string;
}

export default function QuickPlayerInvitation({ campaignId, campaignTitle }: QuickPlayerInvitationProps) {
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteMethod, setInviteMethod] = useState("link");
  const [expirationTime, setExpirationTime] = useState("24h");
  const [maxUses, setMaxUses] = useState("5");
  const [copiedLink, setCopiedLink] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch active invitations
  const { data: activeInvitations = [] } = useQuery({
    queryKey: [`/api/campaigns/${campaignId}/invitations`],
  });

  // Create invitation mutation
  const createInvitationMutation = useMutation({
    mutationFn: async (inviteData: any) => {
      const response = await fetch(`/api/campaigns/${campaignId}/invitations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(inviteData),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create invitation');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Invitation Created",
        description: `Players can now join using code: ${data.inviteCode}`,
      });
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/invitations`] });
      setShowInviteDialog(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Copy invitation link
  const copyInvitationLink = async (inviteCode: string) => {
    const inviteLink = `${window.location.origin}/join-campaign/${inviteCode}`;
    
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopiedLink(true);
      toast({
        title: "Link Copied",
        description: "Invitation link copied to clipboard",
      });
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy link",
        variant: "destructive",
      });
    }
  };

  const handleCreateInvitation = () => {
    const expirationHours = {
      "1h": 1,
      "6h": 6,
      "24h": 24,
      "7d": 168,
      "never": null
    }[expirationTime];

    const inviteData = {
      maxUses: maxUses === "unlimited" ? null : parseInt(maxUses),
      expiresInHours: expirationHours,
    };

    createInvitationMutation.mutate(inviteData);
  };

  const getShareableMessage = (inviteCode: string) => {
    const inviteLink = `${window.location.origin}/join-campaign/${inviteCode}`;
    return `🎲 You're invited to join "${campaignTitle}"!\n\nClick here to join: ${inviteLink}\n\nOr use invite code: ${inviteCode}`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="h-5 w-5" />
          Quick Player Invitations
        </CardTitle>
        <CardDescription>
          Generate instant invites to get players into your live session
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Quick Actions */}
        <div className="flex gap-2">
          <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
            <DialogTrigger asChild>
              <Button className="flex-1">
                <Send className="h-4 w-4 mr-2" />
                Create Instant Invite
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Player Invitation</DialogTitle>
                <DialogDescription>
                  Generate a shareable link or code for players to join "{campaignTitle}"
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <div>
                  <Label>Invitation Type</Label>
                  <Select value={inviteMethod} onValueChange={setInviteMethod}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="link">Shareable Link</SelectItem>
                      <SelectItem value="code">Join Code Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Expires In</Label>
                    <Select value={expirationTime} onValueChange={setExpirationTime}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1h">1 Hour</SelectItem>
                        <SelectItem value="6h">6 Hours</SelectItem>
                        <SelectItem value="24h">24 Hours</SelectItem>
                        <SelectItem value="7d">7 Days</SelectItem>
                        <SelectItem value="never">Never</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Max Uses</Label>
                    <Select value={maxUses} onValueChange={setMaxUses}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 Use</SelectItem>
                        <SelectItem value="3">3 Uses</SelectItem>
                        <SelectItem value="5">5 Uses</SelectItem>
                        <SelectItem value="10">10 Uses</SelectItem>
                        <SelectItem value="unlimited">Unlimited</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button
                  onClick={handleCreateInvitation}
                  disabled={createInvitationMutation.isPending}
                  className="w-full"
                >
                  {createInvitationMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <UserPlus className="h-4 w-4 mr-2" />
                  )}
                  Create Invitation
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Active Invitations */}
        {activeInvitations.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              Active Invitations ({activeInvitations.length})
            </h4>
            
            <div className="space-y-2">
              {activeInvitations.map((invitation: any) => (
                <div key={invitation.id} className="p-3 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="font-mono text-sm bg-muted px-2 py-1 rounded">
                        {invitation.inviteCode}
                      </div>
                      <div className="flex gap-2">
                        {invitation.maxUses && (
                          <Badge variant="secondary">
                            {invitation.useCount || 0}/{invitation.maxUses} uses
                          </Badge>
                        )}
                        {invitation.expiresAt && (
                          <Badge variant="outline">
                            <Clock className="h-3 w-3 mr-1" />
                            {new Date(invitation.expiresAt).toLocaleDateString()}
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyInvitationLink(invitation.inviteCode)}
                      >
                        {copiedLink ? (
                          <CheckCircle className="h-4 w-4" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const message = getShareableMessage(invitation.inviteCode);
                          if (navigator.share) {
                            navigator.share({
                              title: `Join ${campaignTitle}`,
                              text: message,
                            });
                          } else {
                            navigator.clipboard.writeText(message);
                            toast({
                              title: "Message Copied",
                              description: "Shareable invitation message copied to clipboard",
                            });
                          }
                        }}
                      >
                        <Share2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  {/* Quick sharing options */}
                  <div className="mt-2 pt-2 border-t flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const inviteLink = `${window.location.origin}/join-campaign/${invitation.inviteCode}`;
                        window.open(`mailto:?subject=Join ${campaignTitle}&body=${encodeURIComponent(getShareableMessage(invitation.inviteCode))}`, '_blank');
                      }}
                    >
                      <Mail className="h-3 w-3 mr-1" />
                      Email
                    </Button>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const message = getShareableMessage(invitation.inviteCode);
                        window.open(`sms:?body=${encodeURIComponent(message)}`, '_blank');
                      }}
                    >
                      <MessageCircle className="h-3 w-3 mr-1" />
                      SMS
                    </Button>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const inviteLink = `${window.location.origin}/join-campaign/${invitation.inviteCode}`;
                        window.open(inviteLink, '_blank');
                      }}
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Preview
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Tips */}
        <div className="p-3 bg-muted rounded-lg">
          <h5 className="font-medium mb-2">Quick Tips:</h5>
          <ul className="text-sm space-y-1 text-muted-foreground">
            <li>• Share the link via any messaging app or social platform</li>
            <li>• Players just need the code to join - no account required initially</li>
            <li>• Set expiration times for security - 24 hours is recommended</li>
            <li>• Limit uses to prevent unwanted players joining</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}