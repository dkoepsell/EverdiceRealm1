import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Send, MessageCircle, Crown } from "lucide-react";

interface ChatMessage {
  id: string;
  message: string;
  senderId: number;
  senderName: string;
  characterName?: string | null;
  isDM: boolean;
  timestamp: string;
}

interface InitiativeCombatant {
  id?: string;
  characterId?: number;
  name: string;
  initiative: number;
  isPlayer: boolean;
  isCurrentTurn?: boolean;
}

interface TableChatProps {
  campaignId: number;
  characterName?: string;
  characterId?: number;
  isCollapsed?: boolean;
  onToggle?: () => void;
  onInitiativeUpdate?: (isMyTurn: boolean, currentCombatant: string | null) => void;
}

export default function TableChat({ campaignId, characterName, characterId, isCollapsed = false, onToggle, onInitiativeUpdate }: TableChatProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: tableChatData } = useQuery<{
    tableChat: ChatMessage[];
    isActive: boolean;
    initiativeOrder: InitiativeCombatant[];
    currentTurnIndex: number;
  }>({
    queryKey: [`/api/campaigns/${campaignId}/table-chat`],
    refetchInterval: 5000,
  });

  useEffect(() => {
    if (tableChatData?.tableChat) {
      setMessages(tableChatData.tableChat);
    }
    
    if (tableChatData && onInitiativeUpdate) {
      const initiative = tableChatData.initiativeOrder || [];
      const currentIndex = tableChatData.currentTurnIndex || 0;
      
      if (initiative.length > 0 && currentIndex < initiative.length) {
        const currentCombatant = initiative[currentIndex];
        // Check if it's the player's turn by matching characterId or name
        const isMyTurn = (characterId && currentCombatant?.characterId === characterId) || 
                         currentCombatant?.name?.toLowerCase() === characterName?.toLowerCase();
        onInitiativeUpdate(isMyTurn, currentCombatant?.name || null);
      } else {
        // No initiative active - everyone can act
        onInitiativeUpdate(true, null);
      }
    }
  }, [tableChatData, onInitiativeUpdate, characterId, characterName]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    const ws = new WebSocket(`${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`);
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'table-chat' && data.payload?.campaignId === campaignId) {
          setMessages(prev => {
            const exists = prev.some(m => m.id === data.payload.id);
            if (exists) return prev;
            return [...prev, data.payload].slice(-100);
          });
        }
      } catch (e) {
        console.error('WebSocket message error:', e);
      }
    };

    return () => {
      ws.close();
    };
  }, [campaignId]);

  const sendMessageMutation = useMutation({
    mutationFn: async (text: string) => {
      const response = await apiRequest('POST', `/api/campaigns/${campaignId}/table-chat`, {
        message: text,
        senderName: user?.username || 'Unknown',
        characterName: characterName || null,
      });
      return response.json();
    },
    onSuccess: () => {
      setMessage("");
    },
    onError: (error: any) => {
      toast({
        title: "Failed to send message",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSend = () => {
    if (!message.trim()) return;
    sendMessageMutation.mutate(message.trim());
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (isCollapsed) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="fixed bottom-4 right-4 z-50 shadow-lg"
        onClick={onToggle}
      >
        <MessageCircle className="h-4 w-4 mr-2" />
        Table Chat
        {messages.length > 0 && (
          <Badge variant="secondary" className="ml-2">{messages.length}</Badge>
        )}
      </Button>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 rounded-lg border">
      <div className="flex items-center justify-between p-3 border-b bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-amber-600" />
          <span className="font-medium text-sm">Table Chat</span>
          <Badge variant="outline" className="text-xs">{messages.length}</Badge>
        </div>
        {onToggle && (
          <Button variant="ghost" size="sm" onClick={onToggle}>
            Minimize
          </Button>
        )}
      </div>

      <ScrollArea className="flex-1 p-3" ref={scrollRef}>
        <div className="space-y-2">
          {messages.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-4">
              No messages yet. Start the conversation!
            </p>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.senderId === user?.id ? 'items-end' : 'items-start'}`}
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  {msg.isDM && <Crown className="h-3 w-3 text-amber-500" />}
                  <span className="text-xs font-medium text-muted-foreground">
                    {msg.characterName || msg.senderName}
                    {msg.isDM && " (DM)"}
                  </span>
                  <span className="text-xs text-muted-foreground/60">
                    {formatTime(msg.timestamp)}
                  </span>
                </div>
                <div
                  className={`px-3 py-2 rounded-lg max-w-[85%] ${
                    msg.senderId === user?.id
                      ? 'bg-amber-500 text-white'
                      : msg.isDM
                      ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-900 dark:text-purple-100 border border-purple-200 dark:border-purple-800'
                      : 'bg-white dark:bg-slate-800 border'
                  }`}
                >
                  <p className="text-sm">{msg.message}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      <div className="p-3 border-t">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex gap-2"
        >
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Send a message to the table..."
            className="flex-1"
            disabled={sendMessageMutation.isPending}
          />
          <Button
            type="submit"
            size="sm"
            disabled={!message.trim() || sendMessageMutation.isPending}
            className="bg-amber-500 hover:bg-amber-600"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
