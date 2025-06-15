import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  MessageCircle, 
  Users, 
  Send, 
  Hash, 
  Globe, 
  Link2,
  Dice6,
  Crown,
  User
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatMessage {
  id: number;
  userId: number;
  username: string;
  displayName?: string;
  message: string;
  messageType: string;
  channelType: string;
  campaignId?: number;
  campaignTitle?: string;
  diceRoll?: any;
  createdAt: string;
}

interface OnlineUser {
  id: number;
  userId: number;
  username: string;
  displayName?: string;
  isInCampaign: boolean;
  currentCampaignId?: number;
}

interface UniversalChatProps {
  currentCampaignId?: number;
  currentCampaignTitle?: string;
  className?: string;
}

export default function UniversalChat({ 
  currentCampaignId, 
  currentCampaignTitle,
  className 
}: UniversalChatProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const [activeChannel, setActiveChannel] = useState(currentCampaignId ? `campaign-${currentCampaignId}` : "global");
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initialize WebSocket connection
  useEffect(() => {
    if (!user) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log("Chat WebSocket connected");
      ws.send(JSON.stringify({
        type: 'user_connect',
        payload: {
          userId: user.id,
          username: user.username,
          channel: activeChannel
        }
      }));
      setSocket(ws);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'chat_message' && data.channel === activeChannel) {
          setMessages(prev => [...prev, data.payload]);
        } else if (data.type === 'channel_history') {
          setMessages(data.payload);
        } else if (data.type === 'user_online') {
          setOnlineUsers(prev => {
            const existing = prev.find(u => u.userId === data.payload.userId);
            if (!existing) {
              return [...prev, data.payload];
            }
            return prev;
          });
        } else if (data.type === 'user_offline') {
          setOnlineUsers(prev => prev.filter(u => u.userId !== data.payload.userId));
        } else if (data.type === 'dice_roll' && data.channel === activeChannel) {
          const diceMessage: ChatMessage = {
            id: Date.now(),
            userId: data.payload.userId || 0,
            username: data.payload.username || 'System',
            message: `Rolled ${data.payload.result} on a d${data.payload.diceType}`,
            messageType: 'dice-roll',
            channelType: activeChannel.startsWith('campaign-') ? 'campaign' : 'global',
            diceRoll: data.payload,
            createdAt: new Date().toISOString()
          };
          setMessages(prev => [...prev, diceMessage]);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    ws.onclose = () => {
      console.log("Chat WebSocket disconnected");
      setSocket(null);
    };

    ws.onerror = (error) => {
      console.error("Chat WebSocket error:", error);
    };

    return () => {
      ws.close();
    };
  }, [user, activeChannel]);

  // Load chat messages for current channel
  const { data: chatMessages } = useQuery({
    queryKey: [`/api/chat/messages`, activeChannel],
    enabled: !!user,
  });

  // Load online users
  const { data: onlineUsersData } = useQuery({
    queryKey: ['/api/chat/online-users'],
    enabled: !!user,
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (chatMessages) {
      setMessages(chatMessages);
    }
  }, [chatMessages]);

  useEffect(() => {
    if (onlineUsersData) {
      setOnlineUsers(onlineUsersData);
    }
  }, [onlineUsersData]);

  // Send chat message
  const sendMessageMutation = useMutation({
    mutationFn: async (messageData: { message: string; messageType?: string; campaignId?: number }) => {
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        throw new Error("Chat connection not available");
      }

      socket.send(JSON.stringify({
        type: 'chat_message',
        payload: {
          message: messageData.message,
          messageType: messageData.messageType || 'text',
          channelType: activeChannel.startsWith('campaign-') ? 'campaign' : 'global',
          campaignId: activeChannel.startsWith('campaign-') ? parseInt(activeChannel.split('-')[1]) : undefined,
          campaignTitle: currentCampaignTitle
        }
      }));
    },
    onSuccess: () => {
      setMessage("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Handle channel switching
  const switchChannel = (channel: string) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: 'join_channel',
        payload: { channel }
      }));
    }
    setActiveChannel(channel);
    setMessages([]);
  };

  // Handle sending message
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    sendMessageMutation.mutate({ message: message.trim() });
  };

  // Share campaign link
  const shareCampaignLink = (campaignId: number, campaignTitle: string) => {
    const campaignUrl = `${window.location.origin}/campaigns/${campaignId}`;
    const shareMessage = `Join my D&D campaign "${campaignTitle}": ${campaignUrl}`;
    
    sendMessageMutation.mutate({
      message: shareMessage,
      messageType: 'campaign-link',
      campaignId
    });
  };

  // Format message display
  const formatMessage = (msg: ChatMessage) => {
    const timeAgo = new Date(msg.createdAt).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    
    if (msg.messageType === 'dice-roll' && msg.diceRoll) {
      return (
        <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
          <Dice6 className="h-4 w-4 text-primary" />
          <span className="font-medium">{msg.displayName || msg.username}</span>
          <span>rolled</span>
          <Badge variant="outline" className="font-bold">
            {msg.diceRoll.result}
          </Badge>
          <span>on a d{msg.diceRoll.diceType}</span>
          <span className="text-xs text-muted-foreground ml-auto">{timeAgo}</span>
        </div>
      );
    }

    if (msg.messageType === 'campaign-link') {
      return (
        <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Link2 className="h-4 w-4 text-primary" />
            <span className="font-medium">{msg.displayName || msg.username}</span>
            <span className="text-xs text-muted-foreground">{timeAgo}</span>
          </div>
          <p className="text-sm">{msg.message}</p>
        </div>
      );
    }

    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{msg.displayName || msg.username}</span>
          <span className="text-xs text-muted-foreground">{timeAgo}</span>
        </div>
        <p className="text-sm">{msg.message}</p>
      </div>
    );
  };

  if (!user) {
    return (
      <Card className={cn("w-full max-w-md", className)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            Chat
          </CardTitle>
          <CardDescription>
            Sign in to join the conversation
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className={cn("w-full max-w-2xl", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            Universal Chat
          </div>
          <Badge variant="outline" className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {onlineUsers.length} online
          </Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <Tabs value={activeChannel} onValueChange={switchChannel}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="global" className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              Global Chat
            </TabsTrigger>
            {currentCampaignId && (
              <TabsTrigger value={`campaign-${currentCampaignId}`} className="flex items-center gap-2">
                <Hash className="h-4 w-4" />
                {currentCampaignTitle || `Campaign ${currentCampaignId}`}
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value={activeChannel} className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>Online:</span>
              <div className="flex flex-wrap gap-1">
                {onlineUsers.slice(0, 5).map((user) => (
                  <Badge key={user.userId} variant="secondary" className="text-xs">
                    {user.displayName || user.username}
                  </Badge>
                ))}
                {onlineUsers.length > 5 && (
                  <Badge variant="secondary" className="text-xs">
                    +{onlineUsers.length - 5} more
                  </Badge>
                )}
              </div>
            </div>

            <Separator />

            <ScrollArea className="h-80 w-full">
              <div className="space-y-4 p-4">
                {messages.map((msg) => (
                  <div key={msg.id}>
                    {formatMessage(msg)}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            <form onSubmit={handleSendMessage} className="flex gap-2">
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type your message..."
                disabled={sendMessageMutation.isPending}
                className="flex-1"
              />
              <Button 
                type="submit" 
                size="icon"
                disabled={!message.trim() || sendMessageMutation.isPending}
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>

            {activeChannel === 'global' && (
              <div className="flex items-center gap-2 pt-2 border-t">
                <span className="text-xs text-muted-foreground">Quick actions:</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (currentCampaignId && currentCampaignTitle) {
                      shareCampaignLink(currentCampaignId, currentCampaignTitle);
                    }
                  }}
                  disabled={!currentCampaignId || sendMessageMutation.isPending}
                  className="text-xs"
                >
                  <Link2 className="h-3 w-3 mr-1" />
                  Share Campaign
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}