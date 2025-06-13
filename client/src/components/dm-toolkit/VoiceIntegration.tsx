import { useState, useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX,
  Settings,
  Dice6,
  Zap,
  Heart,
  Plus,
  Minus,
  Play,
  Square,
  MessageSquare
} from "lucide-react";

interface VoiceCommand {
  phrase: string;
  action: string;
  description: string;
  category: 'dice' | 'combat' | 'player' | 'navigation' | 'audio';
}

interface VoiceIntegrationProps {
  campaignId: number;
  onVoiceCommand?: (command: string, data: any) => void;
}

export default function VoiceIntegration({ campaignId, onVoiceCommand }: VoiceIntegrationProps) {
  const [isListening, setIsListening] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [confidence, setConfidence] = useState(0);
  const [lastCommand, setLastCommand] = useState<string | null>(null);
  const [speechSupported, setSpeechSupported] = useState(false);
  
  const recognitionRef = useRef<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Voice commands database
  const voiceCommands: VoiceCommand[] = [
    // Dice rolling
    { phrase: "roll d20", action: "roll_dice", description: "Roll a 20-sided die", category: "dice" },
    { phrase: "roll d6", action: "roll_dice", description: "Roll a 6-sided die", category: "dice" },
    { phrase: "roll initiative", action: "roll_initiative", description: "Roll for initiative", category: "dice" },
    { phrase: "advantage", action: "roll_advantage", description: "Roll with advantage", category: "dice" },
    { phrase: "disadvantage", action: "roll_disadvantage", description: "Roll with disadvantage", category: "dice" },
    
    // Combat management
    { phrase: "start combat", action: "start_combat", description: "Begin combat encounter", category: "combat" },
    { phrase: "end combat", action: "end_combat", description: "End combat encounter", category: "combat" },
    { phrase: "next turn", action: "next_turn", description: "Advance to next turn", category: "combat" },
    { phrase: "add monster", action: "add_monster", description: "Add monster to initiative", category: "combat" },
    
    // Player management
    { phrase: "heal 5", action: "heal_player", description: "Heal player for 5 HP", category: "player" },
    { phrase: "damage 5", action: "damage_player", description: "Deal 5 damage to player", category: "player" },
    { phrase: "add condition", action: "add_condition", description: "Add status condition", category: "player" },
    { phrase: "remove condition", action: "remove_condition", description: "Remove status condition", category: "player" },
    
    // Audio control
    { phrase: "play music", action: "play_music", description: "Start ambient music", category: "audio" },
    { phrase: "stop music", action: "stop_music", description: "Stop all audio", category: "audio" },
    { phrase: "combat music", action: "combat_music", description: "Play combat music", category: "audio" },
    { phrase: "sound effect", action: "sound_effect", description: "Play sound effect", category: "audio" },
    
    // Navigation
    { phrase: "show players", action: "navigate", description: "Switch to player dashboard", category: "navigation" },
    { phrase: "show initiative", action: "navigate", description: "Switch to initiative tracker", category: "navigation" },
    { phrase: "show map", action: "navigate", description: "Switch to battle map", category: "navigation" }
  ];

  // Process voice command mutation
  const processCommandMutation = useMutation({
    mutationFn: async ({ command, transcript }: { command: string; transcript: string }) => {
      return apiRequest(`/api/campaigns/${campaignId}/voice-command`, {
        method: 'POST',
        body: JSON.stringify({ command, transcript })
      });
    },
    onSuccess: (data, variables) => {
      setLastCommand(variables.command);
      if (onVoiceCommand) {
        onVoiceCommand(variables.command, data);
      }
      toast({
        title: "Voice Command Executed",
        description: `Executed: ${variables.command}`,
        duration: 2000
      });
    },
    onError: (error) => {
      toast({
        title: "Command Failed",
        description: "Could not process voice command",
        variant: "destructive"
      });
    }
  });

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      
      if (SpeechRecognition) {
        setSpeechSupported(true);
        recognitionRef.current = new SpeechRecognition();
        
        const recognition = recognitionRef.current;
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';
        
        recognition.onstart = () => {
          setIsListening(true);
        };
        
        recognition.onend = () => {
          setIsListening(false);
          if (isEnabled) {
            // Restart recognition if still enabled
            setTimeout(() => {
              if (isEnabled && recognitionRef.current) {
                recognitionRef.current.start();
              }
            }, 100);
          }
        };
        
        recognition.onresult = (event: any) => {
          let finalTranscript = '';
          let interimTranscript = '';
          
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const result = event.results[i];
            if (result.isFinal) {
              finalTranscript += result[0].transcript;
              setConfidence(result[0].confidence);
            } else {
              interimTranscript += result[0].transcript;
            }
          }
          
          const fullTranscript = finalTranscript || interimTranscript;
          setTranscript(fullTranscript);
          
          if (finalTranscript) {
            processVoiceCommand(finalTranscript.toLowerCase().trim());
          }
        };
        
        recognition.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error);
          if (event.error === 'not-allowed') {
            toast({
              title: "Microphone Access Denied",
              description: "Please allow microphone access to use voice commands",
              variant: "destructive"
            });
            setIsEnabled(false);
          }
        };
      } else {
        setSpeechSupported(false);
      }
    }
    
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [isEnabled]);

  const processVoiceCommand = (transcript: string) => {
    // Find matching command
    const matchedCommand = voiceCommands.find(cmd => 
      transcript.includes(cmd.phrase.toLowerCase())
    );
    
    if (matchedCommand) {
      // Extract parameters from transcript
      let commandData: any = { action: matchedCommand.action };
      
      // Parse specific parameters
      if (matchedCommand.action === 'roll_dice') {
        const diceMatch = transcript.match(/d(\d+)/);
        if (diceMatch) {
          commandData.diceType = `d${diceMatch[1]}`;
        }
        
        const modifierMatch = transcript.match(/(?:plus|add|\+)\s*(\d+)|(?:minus|subtract|-)\s*(\d+)/);
        if (modifierMatch) {
          commandData.modifier = modifierMatch[1] ? parseInt(modifierMatch[1]) : -parseInt(modifierMatch[2]);
        }
      }
      
      if (matchedCommand.action === 'heal_player' || matchedCommand.action === 'damage_player') {
        const amountMatch = transcript.match(/(\d+)/);
        if (amountMatch) {
          commandData.amount = parseInt(amountMatch[1]);
        }
      }
      
      if (matchedCommand.action === 'navigate') {
        if (transcript.includes('player')) commandData.tab = 'player-dashboard';
        else if (transcript.includes('initiative')) commandData.tab = 'initiative';
        else if (transcript.includes('map')) commandData.tab = 'battle-map';
      }
      
      processCommandMutation.mutate({
        command: matchedCommand.action,
        transcript
      });
    } else {
      // Try natural language processing for common phrases
      if (transcript.includes('roll') && transcript.includes('20')) {
        processCommandMutation.mutate({
          command: 'roll_dice',
          transcript
        });
      } else if (transcript.includes('heal') || transcript.includes('damage')) {
        const amountMatch = transcript.match(/(\d+)/);
        const amount = amountMatch ? parseInt(amountMatch[1]) : 1;
        const action = transcript.includes('heal') ? 'heal_player' : 'damage_player';
        
        processCommandMutation.mutate({
          command: action,
          transcript
        });
      }
    }
  };

  const toggleVoiceRecognition = async () => {
    if (!speechSupported) {
      toast({
        title: "Speech Recognition Not Supported",
        description: "Your browser doesn't support speech recognition",
        variant: "destructive"
      });
      return;
    }

    if (isEnabled) {
      setIsEnabled(false);
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    } else {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        setIsEnabled(true);
        if (recognitionRef.current) {
          recognitionRef.current.start();
        }
      } catch (error) {
        toast({
          title: "Microphone Access Required",
          description: "Please allow microphone access to use voice commands",
          variant: "destructive"
        });
      }
    }
  };

  const speakText = (text: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.8;
      utterance.pitch = 1;
      utterance.volume = 0.8;
      speechSynthesis.speak(utterance);
    }
  };

  const groupedCommands = voiceCommands.reduce((acc, cmd) => {
    if (!acc[cmd.category]) acc[cmd.category] = [];
    acc[cmd.category].push(cmd);
    return acc;
  }, {} as { [key: string]: VoiceCommand[] });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Voice Integration</h3>
        <div className="flex items-center space-x-2">
          {isListening && (
            <Badge variant="default" className="animate-pulse">
              <Mic className="h-3 w-3 mr-1" />
              Listening
            </Badge>
          )}
          {isEnabled && !isListening && (
            <Badge variant="secondary">
              <MicOff className="h-3 w-3 mr-1" />
              Ready
            </Badge>
          )}
          {!speechSupported && (
            <Badge variant="destructive">
              Not Supported
            </Badge>
          )}
        </div>
      </div>

      {/* Voice Control Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Voice Control</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium">Voice Recognition</h4>
              <p className="text-sm text-muted-foreground">
                Enable hands-free control of the DM toolkit
              </p>
            </div>
            <Button
              onClick={toggleVoiceRecognition}
              disabled={!speechSupported}
              variant={isEnabled ? "destructive" : "default"}
            >
              {isEnabled ? (
                <>
                  <MicOff className="h-4 w-4 mr-2" />
                  Disable Voice
                </>
              ) : (
                <>
                  <Mic className="h-4 w-4 mr-2" />
                  Enable Voice
                </>
              )}
            </Button>
          </div>

          {isEnabled && (
            <div className="space-y-2">
              <div className="p-3 border rounded bg-muted/50">
                <div className="flex items-center justify-between text-sm">
                  <span>Current transcript:</span>
                  <span>Confidence: {Math.round(confidence * 100)}%</span>
                </div>
                <p className="font-mono text-sm mt-1">
                  {transcript || "Say a command..."}
                </p>
              </div>

              {lastCommand && (
                <div className="p-2 border rounded bg-green-50 text-sm">
                  <span className="font-medium">Last command:</span> {lastCommand}
                </div>
              )}
            </div>
          )}

          <div className="flex space-x-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => speakText("Voice commands ready. Say roll d20 to test.")}
            >
              <Volume2 className="h-3 w-3 mr-1" />
              Test Speech
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setTranscript("")}
            >
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Voice Commands Reference */}
      <Tabs defaultValue="dice" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="dice">Dice</TabsTrigger>
          <TabsTrigger value="combat">Combat</TabsTrigger>
          <TabsTrigger value="player">Players</TabsTrigger>
          <TabsTrigger value="audio">Audio</TabsTrigger>
          <TabsTrigger value="navigation">Navigate</TabsTrigger>
        </TabsList>

        {Object.entries(groupedCommands).map(([category, commands]) => (
          <TabsContent key={category} value={category} className="space-y-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm capitalize">{category} Commands</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {commands.map((cmd, index) => (
                    <div key={index} className="flex items-center justify-between p-2 border rounded">
                      <div>
                        <span className="font-mono text-sm bg-muted px-2 py-1 rounded">
                          "{cmd.phrase}"
                        </span>
                        <p className="text-xs text-muted-foreground mt-1">
                          {cmd.description}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => processVoiceCommand(cmd.phrase)}
                        disabled={processCommandMutation.isPending}
                      >
                        <Play className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      {/* Quick Voice Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Quick Voice Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => processVoiceCommand("roll d20")}
              disabled={processCommandMutation.isPending}
            >
              <Dice6 className="h-3 w-3 mr-1" />
              Roll d20
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => processVoiceCommand("start combat")}
              disabled={processCommandMutation.isPending}
            >
              <Zap className="h-3 w-3 mr-1" />
              Start Combat
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => processVoiceCommand("heal 5")}
              disabled={processCommandMutation.isPending}
            >
              <Heart className="h-3 w-3 mr-1" />
              Heal 5
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => processVoiceCommand("play music")}
              disabled={processCommandMutation.isPending}
            >
              <Volume2 className="h-3 w-3 mr-1" />
              Play Music
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}