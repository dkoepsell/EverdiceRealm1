import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Circle,
  Square,
  Play,
  Pause,
  Download,
  Bookmark,
  Clock,
  MessageSquare,
  Dice6,
  Users,
  Swords,
  Star,
  FileText
} from "lucide-react";

interface SessionEvent {
  id: string;
  timestamp: string;
  type: 'dice_roll' | 'combat_start' | 'combat_end' | 'player_action' | 'dm_note' | 'narrative' | 'bookmark';
  data: any;
  description: string;
  important: boolean;
}

interface SessionRecording {
  id: string;
  campaignId: number;
  sessionNumber: number;
  startTime: string;
  endTime?: string;
  duration: number;
  events: SessionEvent[];
  bookmarks: { timestamp: string; title: string; description: string }[];
  summary: string;
  participants: string[];
}

interface SessionRecorderProps {
  campaignId: number;
}

export default function SessionRecorder({ campaignId }: SessionRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [currentSession, setCurrentSession] = useState<string | null>(null);
  const [sessionNotes, setSessionNotes] = useState("");
  const [bookmarkTitle, setBookmarkTitle] = useState("");
  const [bookmarkDescription, setBookmarkDescription] = useState("");
  const [eventFilter, setEventFilter] = useState<string>("all");
  
  const recordingStartTime = useRef<Date | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch current session if recording
  const { data: activeSession } = useQuery<SessionRecording>({
    queryKey: [`/api/campaigns/${campaignId}/session-recording/active`],
    refetchInterval: isRecording ? 5000 : false,
    enabled: !!campaignId && isRecording
  });

  // Fetch session history
  const { data: sessionHistory = [] } = useQuery<SessionRecording[]>({
    queryKey: [`/api/campaigns/${campaignId}/session-recordings`],
    enabled: !!campaignId
  });

  // Start recording mutation
  const startRecordingMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/campaigns/${campaignId}/session-recording/start`, {
        method: 'POST'
      });
    },
    onSuccess: (data: any) => {
      setIsRecording(true);
      setCurrentSession(data.sessionId);
      recordingStartTime.current = new Date();
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/session-recording/active`] });
      toast({
        title: "Recording Started",
        description: "Session recording is now active"
      });
    }
  });

  // Stop recording mutation
  const stopRecordingMutation = useMutation({
    mutationFn: async (summary: string) => {
      return apiRequest(`/api/campaigns/${campaignId}/session-recording/stop`, {
        method: 'POST',
        body: JSON.stringify({ summary })
      });
    },
    onSuccess: () => {
      setIsRecording(false);
      setCurrentSession(null);
      recordingStartTime.current = null;
      setSessionNotes("");
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/session-recordings`] });
      toast({
        title: "Recording Stopped",
        description: "Session has been saved with summary"
      });
    }
  });

  // Add bookmark mutation
  const addBookmarkMutation = useMutation({
    mutationFn: async ({ title, description }: { title: string; description: string }) => {
      return apiRequest(`/api/campaigns/${campaignId}/session-recording/bookmark`, {
        method: 'POST',
        body: JSON.stringify({ 
          title, 
          description,
          timestamp: new Date().toISOString()
        })
      });
    },
    onSuccess: () => {
      setBookmarkTitle("");
      setBookmarkDescription("");
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/session-recording/active`] });
      toast({
        title: "Bookmark Added",
        description: "Important moment marked in session"
      });
    }
  });

  // Export session mutation
  const exportSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      return apiRequest(`/api/campaigns/${campaignId}/session-recordings/${sessionId}/export`, {
        method: 'GET'
      });
    },
    onSuccess: (data: any) => {
      // Create download link
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `session-${data.sessionNumber}-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: "Session Exported",
        description: "Session data downloaded successfully"
      });
    }
  });

  const handleStartRecording = () => {
    startRecordingMutation.mutate();
  };

  const handleStopRecording = () => {
    if (sessionNotes.trim()) {
      stopRecordingMutation.mutate(sessionNotes);
    } else {
      toast({
        title: "Session Summary Required",
        description: "Please add a summary before stopping the recording",
        variant: "destructive"
      });
    }
  };

  const handleAddBookmark = () => {
    if (bookmarkTitle.trim()) {
      addBookmarkMutation.mutate({
        title: bookmarkTitle,
        description: bookmarkDescription
      });
    }
  };

  const getEventIcon = (type: string) => {
    const icons: { [key: string]: JSX.Element } = {
      'dice_roll': <Dice6 className="h-3 w-3" />,
      'combat_start': <Swords className="h-3 w-3" />,
      'combat_end': <Square className="h-3 w-3" />,
      'player_action': <Users className="h-3 w-3" />,
      'dm_note': <MessageSquare className="h-3 w-3" />,
      'narrative': <FileText className="h-3 w-3" />,
      'bookmark': <Bookmark className="h-3 w-3" />
    };
    return icons[type] || <Star className="h-3 w-3" />;
  };

  const formatDuration = (duration: number) => {
    const hours = Math.floor(duration / 3600);
    const minutes = Math.floor((duration % 3600) / 60);
    const seconds = duration % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const filteredEvents = activeSession?.events.filter(event => 
    eventFilter === 'all' || 
    event.type === eventFilter || 
    (eventFilter === 'important' && event.important)
  ) || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Session Recording</h3>
        <div className="flex items-center space-x-2">
          {isRecording && (
            <Badge variant="destructive" className="animate-pulse">
              <Circle className="h-3 w-3 mr-1" />
              Recording
            </Badge>
          )}
          {activeSession && (
            <Badge variant="secondary">
              <Clock className="h-3 w-3 mr-1" />
              {formatDuration(Math.floor((new Date().getTime() - new Date(activeSession.startTime).getTime()) / 1000))}
            </Badge>
          )}
        </div>
      </div>

      <Tabs defaultValue="current" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="current">Current Session</TabsTrigger>
          <TabsTrigger value="history">Session History</TabsTrigger>
        </TabsList>

        {/* Current Session */}
        <TabsContent value="current" className="space-y-4">
          {!isRecording ? (
            <Card>
              <CardContent className="p-6 text-center">
                <Record className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h4 className="text-lg font-medium mb-2">Start Session Recording</h4>
                <p className="text-muted-foreground mb-4">
                  Record all game events, dice rolls, and important moments for later review
                </p>
                <Button
                  onClick={handleStartRecording}
                  disabled={startRecordingMutation.isPending}
                  className="bg-red-600 hover:bg-red-700"
                >
                  <Record className="h-4 w-4 mr-2" />
                  Start Recording
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {/* Recording Controls */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Recording Controls</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">Quick Bookmark</label>
                      <div className="flex space-x-2 mt-1">
                        <Input
                          placeholder="Bookmark title"
                          value={bookmarkTitle}
                          onChange={(e) => setBookmarkTitle(e.target.value)}
                        />
                        <Button
                          size="sm"
                          onClick={handleAddBookmark}
                          disabled={!bookmarkTitle.trim() || addBookmarkMutation.isPending}
                        >
                          <Bookmark className="h-4 w-4" />
                        </Button>
                      </div>
                      {bookmarkTitle && (
                        <Textarea
                          placeholder="Bookmark description (optional)"
                          value={bookmarkDescription}
                          onChange={(e) => setBookmarkDescription(e.target.value)}
                          className="mt-2"
                          rows={2}
                        />
                      )}
                    </div>

                    <div>
                      <label className="text-sm font-medium">Session Summary</label>
                      <Textarea
                        placeholder="Summarize what happened this session..."
                        value={sessionNotes}
                        onChange={(e) => setSessionNotes(e.target.value)}
                        className="mt-1"
                        rows={3}
                      />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button
                      onClick={handleStopRecording}
                      disabled={stopRecordingMutation.isPending}
                      variant="destructive"
                    >
                      <Square className="h-4 w-4 mr-2" />
                      Stop Recording
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Live Events */}
              {activeSession && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">Live Session Events</CardTitle>
                      <select
                        value={eventFilter}
                        onChange={(e) => setEventFilter(e.target.value)}
                        className="text-xs border rounded px-2 py-1"
                      >
                        <option value="all">All Events</option>
                        <option value="important">Important Only</option>
                        <option value="dice_roll">Dice Rolls</option>
                        <option value="combat_start">Combat</option>
                        <option value="player_action">Player Actions</option>
                        <option value="bookmark">Bookmarks</option>
                      </select>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-64">
                      <div className="space-y-2">
                        {filteredEvents.slice().reverse().map((event) => (
                          <div
                            key={event.id}
                            className={`flex items-start space-x-3 p-2 rounded border ${
                              event.important ? 'border-yellow-300 bg-yellow-50' : ''
                            }`}
                          >
                            <div className="flex-shrink-0 mt-1">
                              {getEventIcon(event.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">{event.description}</span>
                                <span className="text-xs text-muted-foreground">
                                  {new Date(event.timestamp).toLocaleTimeString()}
                                </span>
                              </div>
                              {event.data && (
                                <pre className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">
                                  {JSON.stringify(event.data, null, 2)}
                                </pre>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        {/* Session History */}
        <TabsContent value="history" className="space-y-4">
          <div className="space-y-2">
            {sessionHistory.map((session) => (
              <Card key={session.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">Session #{session.sessionNumber}</h4>
                      <p className="text-sm text-muted-foreground">
                        {new Date(session.startTime).toLocaleDateString()} • 
                        Duration: {formatDuration(session.duration)} • 
                        {session.events.length} events • 
                        {session.bookmarks.length} bookmarks
                      </p>
                      {session.summary && (
                        <p className="text-sm mt-1">{session.summary}</p>
                      )}
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline" className="text-xs">
                        {session.participants.length} players
                      </Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => exportSessionMutation.mutate(session.id)}
                        disabled={exportSessionMutation.isPending}
                      >
                        <Download className="h-3 w-3 mr-1" />
                        Export
                      </Button>
                    </div>
                  </div>

                  {session.bookmarks.length > 0 && (
                    <div className="mt-3">
                      <span className="text-xs font-medium">Key Moments:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {session.bookmarks.map((bookmark, index) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            <Bookmark className="h-2 w-2 mr-1" />
                            {bookmark.title}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}

            {sessionHistory.length === 0 && (
              <Card>
                <CardContent className="p-6 text-center">
                  <FileText className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">No recorded sessions yet</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}