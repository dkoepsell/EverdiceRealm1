import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { 
  Volume2, 
  VolumeX, 
  Play, 
  Pause, 
  Square,
  Music,
  Zap,
  Sparkles,
  Wind,
  Flame,
  Droplets,
  Mountain,
  Upload,
  Plus,
  Trash2,
  RotateCw
} from "lucide-react";

interface AudioTrack {
  id: string;
  name: string;
  type: 'ambient' | 'combat' | 'tension' | 'peaceful' | 'dungeon' | 'city' | 'nature';
  url: string;
  volume: number;
  loop: boolean;
  isPlaying: boolean;
  duration?: number;
}

interface SoundEffect {
  id: string;
  name: string;
  category: 'spell' | 'weapon' | 'environment' | 'creature' | 'dice';
  url: string;
  volume: number;
  trigger?: string;
}

interface VisualEffect {
  id: string;
  name: string;
  type: 'spell' | 'environment' | 'status';
  color: string;
  duration: number;
  intensity: number;
  pattern: 'pulse' | 'fade' | 'flash' | 'ripple';
}

interface AudioVisualControllerProps {
  campaignId: number;
}

export default function AudioVisualController({ campaignId }: AudioVisualControllerProps) {
  const [masterVolume, setMasterVolume] = useState(70);
  const [ambientVolume, setAmbientVolume] = useState(50);
  const [effectsVolume, setEffectsVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);
  const [currentlyPlaying, setCurrentlyPlaying] = useState<string | null>(null);
  const [activeEffects, setActiveEffects] = useState<VisualEffect[]>([]);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const { toast } = useToast();

  // Fetch audio/visual presets
  const { data: audioTracks = [] } = useQuery<AudioTrack[]>({
    queryKey: [`/api/campaigns/${campaignId}/audio-tracks`],
    enabled: !!campaignId
  });

  const { data: soundEffects = [] } = useQuery<SoundEffect[]>({
    queryKey: [`/api/campaigns/${campaignId}/sound-effects`],
    enabled: !!campaignId
  });

  // Play ambient track
  const playAmbientMutation = useMutation({
    mutationFn: async ({ trackId, volume }: { trackId: string; volume: number }) => {
      return apiRequest(`/api/campaigns/${campaignId}/audio/play`, {
        method: 'POST',
        body: JSON.stringify({ trackId, volume, type: 'ambient' })
      });
    },
    onSuccess: (data) => {
      setCurrentlyPlaying(data.trackId);
      toast({
        title: "Audio Started",
        description: `Playing ${data.trackName}`
      });
    }
  });

  // Play sound effect
  const playSoundEffectMutation = useMutation({
    mutationFn: async ({ effectId, volume }: { effectId: string; volume: number }) => {
      return apiRequest(`/api/campaigns/${campaignId}/audio/effect`, {
        method: 'POST',
        body: JSON.stringify({ effectId, volume })
      });
    },
    onSuccess: (data) => {
      toast({
        title: "Sound Effect",
        description: `Played ${data.effectName}`,
        duration: 2000
      });
    }
  });

  // Trigger visual effect
  const triggerVisualEffectMutation = useMutation({
    mutationFn: async (effect: Omit<VisualEffect, 'id'>) => {
      return apiRequest(`/api/campaigns/${campaignId}/visual-effects`, {
        method: 'POST',
        body: JSON.stringify(effect)
      });
    },
    onSuccess: (data) => {
      setActiveEffects(prev => [...prev, data]);
      
      // Auto-remove effect after duration
      setTimeout(() => {
        setActiveEffects(prev => prev.filter(e => e.id !== data.id));
      }, data.duration * 1000);

      toast({
        title: "Visual Effect",
        description: `Triggered ${data.name}`,
        duration: 2000
      });
    }
  });

  // Stop audio
  const stopAudioMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/campaigns/${campaignId}/audio/stop`, {
        method: 'POST'
      });
    },
    onSuccess: () => {
      setCurrentlyPlaying(null);
      toast({
        title: "Audio Stopped",
        description: "All audio tracks have been stopped"
      });
    }
  });

  // Preset audio collections
  const audioPresets = {
    combat: [
      { name: "Epic Battle", type: "combat", icon: "⚔️" },
      { name: "Tense Encounter", type: "tension", icon: "🎯" },
      { name: "Boss Fight", type: "combat", icon: "👹" }
    ],
    exploration: [
      { name: "Peaceful Forest", type: "nature", icon: "🌲" },
      { name: "Mysterious Dungeon", type: "dungeon", icon: "🏰" },
      { name: "Bustling City", type: "city", icon: "🏘️" }
    ],
    atmosphere: [
      { name: "Thunderstorm", type: "ambient", icon: "⛈️" },
      { name: "Crackling Fire", type: "ambient", icon: "🔥" },
      { name: "Ocean Waves", type: "ambient", icon: "🌊" }
    ]
  };

  // Sound effect presets
  const effectPresets = {
    spells: [
      { name: "Fireball", category: "spell", icon: "🔥" },
      { name: "Lightning Bolt", category: "spell", icon: "⚡" },
      { name: "Healing Light", category: "spell", icon: "✨" },
      { name: "Ice Shard", category: "spell", icon: "❄️" }
    ],
    combat: [
      { name: "Sword Clang", category: "weapon", icon: "⚔️" },
      { name: "Arrow Release", category: "weapon", icon: "🏹" },
      { name: "Shield Block", category: "weapon", icon: "🛡️" },
      { name: "Critical Hit", category: "weapon", icon: "💥" }
    ],
    environment: [
      { name: "Door Creak", category: "environment", icon: "🚪" },
      { name: "Footsteps", category: "environment", icon: "👣" },
      { name: "Chest Open", category: "environment", icon: "📦" },
      { name: "Trap Trigger", category: "environment", icon: "⚠️" }
    ]
  };

  // Visual effect presets
  const visualPresets = [
    { name: "Magic Missile", color: "#8a2be2", pattern: "flash", duration: 1 },
    { name: "Healing Aura", color: "#32cd32", pattern: "pulse", duration: 3 },
    { name: "Fire Explosion", color: "#ff4500", pattern: "ripple", duration: 2 },
    { name: "Ice Shield", color: "#87ceeb", pattern: "fade", duration: 4 },
    { name: "Lightning Strike", color: "#ffff00", pattern: "flash", duration: 0.5 },
    { name: "Poison Cloud", color: "#9acd32", pattern: "pulse", duration: 5 }
  ];

  const handleVolumeChange = (type: 'master' | 'ambient' | 'effects', value: number[]) => {
    const volume = value[0];
    switch (type) {
      case 'master':
        setMasterVolume(volume);
        break;
      case 'ambient':
        setAmbientVolume(volume);
        break;
      case 'effects':
        setEffectsVolume(volume);
        break;
    }
  };

  const playPresetAudio = (preset: any) => {
    playAmbientMutation.mutate({
      trackId: `preset_${preset.name.toLowerCase().replace(' ', '_')}`,
      volume: (ambientVolume * masterVolume) / 100
    });
  };

  const playPresetEffect = (effect: any) => {
    playSoundEffectMutation.mutate({
      effectId: `preset_${effect.name.toLowerCase().replace(' ', '_')}`,
      volume: (effectsVolume * masterVolume) / 100
    });
  };

  const triggerPresetVisual = (visual: any) => {
    triggerVisualEffectMutation.mutate({
      name: visual.name,
      type: 'spell',
      color: visual.color,
      duration: visual.duration,
      intensity: 80,
      pattern: visual.pattern as any
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Audio & Visual Effects</h3>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsMuted(!isMuted)}
          >
            {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </Button>
          <Badge variant={currentlyPlaying ? "default" : "secondary"}>
            {currentlyPlaying ? "Playing" : "Stopped"}
          </Badge>
        </div>
      </div>

      {/* Volume Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Volume Controls</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Master Volume</span>
              <span>{masterVolume}%</span>
            </div>
            <Slider
              value={[masterVolume]}
              onValueChange={(value) => handleVolumeChange('master', value)}
              max={100}
              step={1}
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Ambient Music</span>
              <span>{ambientVolume}%</span>
            </div>
            <Slider
              value={[ambientVolume]}
              onValueChange={(value) => handleVolumeChange('ambient', value)}
              max={100}
              step={1}
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Sound Effects</span>
              <span>{effectsVolume}%</span>
            </div>
            <Slider
              value={[effectsVolume]}
              onValueChange={(value) => handleVolumeChange('effects', value)}
              max={100}
              step={1}
              className="w-full"
            />
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="ambient" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="ambient">
            <Music className="h-4 w-4 mr-1" />
            Ambient Audio
          </TabsTrigger>
          <TabsTrigger value="effects">
            <Zap className="h-4 w-4 mr-1" />
            Sound Effects
          </TabsTrigger>
          <TabsTrigger value="visual">
            <Sparkles className="h-4 w-4 mr-1" />
            Visual Effects
          </TabsTrigger>
        </TabsList>

        {/* Ambient Audio */}
        <TabsContent value="ambient" className="space-y-4">
          {Object.entries(audioPresets).map(([category, tracks]) => (
            <Card key={category}>
              <CardHeader>
                <CardTitle className="text-sm capitalize">{category}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {tracks.map((track) => (
                    <Button
                      key={track.name}
                      variant="outline"
                      size="sm"
                      onClick={() => playPresetAudio(track)}
                      disabled={playAmbientMutation.isPending}
                      className="text-xs"
                    >
                      <span className="mr-1">{track.icon}</span>
                      {track.name}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}

          <div className="flex justify-center">
            <Button
              variant="destructive"
              onClick={() => stopAudioMutation.mutate()}
              disabled={!currentlyPlaying || stopAudioMutation.isPending}
            >
              <Square className="h-4 w-4 mr-1" />
              Stop All Audio
            </Button>
          </div>
        </TabsContent>

        {/* Sound Effects */}
        <TabsContent value="effects" className="space-y-4">
          {Object.entries(effectPresets).map(([category, effects]) => (
            <Card key={category}>
              <CardHeader>
                <CardTitle className="text-sm capitalize">{category}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {effects.map((effect) => (
                    <Button
                      key={effect.name}
                      variant="outline"
                      size="sm"
                      onClick={() => playPresetEffect(effect)}
                      disabled={playSoundEffectMutation.isPending}
                      className="text-xs"
                    >
                      <span className="mr-1">{effect.icon}</span>
                      {effect.name}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Visual Effects */}
        <TabsContent value="visual" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Spell & Ability Effects</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {visualPresets.map((visual) => (
                  <Button
                    key={visual.name}
                    variant="outline"
                    size="sm"
                    onClick={() => triggerPresetVisual(visual)}
                    disabled={triggerVisualEffectMutation.isPending}
                    className="text-xs"
                    style={{ borderColor: visual.color }}
                  >
                    <div
                      className="w-2 h-2 rounded-full mr-2"
                      style={{ backgroundColor: visual.color }}
                    />
                    {visual.name}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Active Visual Effects */}
          {activeEffects.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Active Effects</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {activeEffects.map((effect) => (
                    <div
                      key={effect.id}
                      className="flex items-center justify-between p-2 border rounded"
                    >
                      <div className="flex items-center space-x-2">
                        <div
                          className="w-3 h-3 rounded-full animate-pulse"
                          style={{ backgroundColor: effect.color }}
                        />
                        <span className="text-sm">{effect.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {effect.pattern}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {effect.duration}s
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}