import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Map, 
  Users, 
  Plus, 
  Move, 
  Circle, 
  Square, 
  Eye,
  EyeOff,
  Zap,
  Target,
  RotateCw,
  Trash2,
  Upload,
  Grid3X3,
  Ruler
} from "lucide-react";

interface MapToken {
  id: string;
  name: string;
  type: 'player' | 'npc' | 'monster' | 'object';
  x: number;
  y: number;
  size: number;
  color: string;
  characterId?: number;
  hp?: number;
  maxHp?: number;
  conditions: string[];
  isVisible: boolean;
}

interface MapEffect {
  id: string;
  type: 'aoe' | 'wall' | 'difficult' | 'hazard';
  shape: 'circle' | 'square' | 'line' | 'cone';
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  opacity: number;
  description: string;
}

interface FogRegion {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  revealed: boolean;
}

interface SharedBattleMapProps {
  campaignId: number;
}

export default function SharedBattleMap({ campaignId }: SharedBattleMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedTool, setSelectedTool] = useState<'move' | 'token' | 'effect' | 'fog'>('move');
  const [selectedToken, setSelectedToken] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [gridSize, setGridSize] = useState(30);
  const [mapImage, setMapImage] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch map data
  const { data: mapData } = useQuery({
    queryKey: [`/api/campaigns/${campaignId}/battle-map`],
    refetchInterval: 2000,
    enabled: !!campaignId
  });

  const tokens: MapToken[] = mapData?.tokens || [];
  const effects: MapEffect[] = mapData?.effects || [];
  const fogRegions: FogRegion[] = mapData?.fogRegions || [];

  // Update token mutation
  const updateTokenMutation = useMutation({
    mutationFn: async ({ tokenId, updates }: { tokenId: string; updates: Partial<MapToken> }) => {
      return apiRequest(`/api/campaigns/${campaignId}/battle-map/tokens/${tokenId}`, {
        method: 'PATCH',
        body: JSON.stringify(updates)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/battle-map`] });
    }
  });

  // Add token mutation
  const addTokenMutation = useMutation({
    mutationFn: async (token: Omit<MapToken, 'id'>) => {
      return apiRequest(`/api/campaigns/${campaignId}/battle-map/tokens`, {
        method: 'POST',
        body: JSON.stringify(token)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/battle-map`] });
      toast({
        title: "Token Added",
        description: "New token placed on the battle map"
      });
    }
  });

  // Add effect mutation
  const addEffectMutation = useMutation({
    mutationFn: async (effect: Omit<MapEffect, 'id'>) => {
      return apiRequest(`/api/campaigns/${campaignId}/battle-map/effects`, {
        method: 'POST',
        body: JSON.stringify(effect)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/battle-map`] });
      toast({
        title: "Effect Added",
        description: "Area effect placed on the battle map"
      });
    }
  });

  // Update fog mutation
  const updateFogMutation = useMutation({
    mutationFn: async ({ x, y, revealed }: { x: number; y: number; revealed: boolean }) => {
      return apiRequest(`/api/campaigns/${campaignId}/battle-map/fog`, {
        method: 'POST',
        body: JSON.stringify({ x, y, revealed })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/battle-map`] });
    }
  });

  // Upload map image
  const uploadMapMutation = useMutation({
    mutationFn: async (imageFile: File) => {
      const formData = new FormData();
      formData.append('image', imageFile);
      return apiRequest(`/api/campaigns/${campaignId}/battle-map/upload`, {
        method: 'POST',
        body: formData
      });
    },
    onSuccess: (data) => {
      setMapImage(data.imageUrl);
      toast({
        title: "Map Uploaded",
        description: "Battle map image has been updated"
      });
    }
  });

  // Canvas drawing effect
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Apply scale and offset
    ctx.save();
    ctx.scale(scale, scale);
    ctx.translate(offset.x, offset.y);

    // Draw background image if available
    if (mapImage) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width / scale, canvas.height / scale);
        drawMapElements(ctx);
      };
      img.src = mapImage;
    } else {
      // Draw default background
      ctx.fillStyle = '#f8f9fa';
      ctx.fillRect(0, 0, canvas.width / scale, canvas.height / scale);
      drawMapElements(ctx);
    }

    function drawMapElements(ctx: CanvasRenderingContext2D) {
      // Draw grid
      if (showGrid) {
        ctx.strokeStyle = '#e9ecef';
        ctx.lineWidth = 1;
        for (let x = 0; x < canvas.width / scale; x += gridSize) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, canvas.height / scale);
          ctx.stroke();
        }
        for (let y = 0; y < canvas.height / scale; y += gridSize) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(canvas.width / scale, y);
          ctx.stroke();
        }
      }

      // Draw fog of war
      fogRegions.forEach(fog => {
        if (!fog.revealed) {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
          ctx.fillRect(fog.x, fog.y, fog.width, fog.height);
        }
      });

      // Draw effects
      effects.forEach(effect => {
        ctx.globalAlpha = effect.opacity;
        ctx.fillStyle = effect.color;
        
        if (effect.shape === 'circle') {
          ctx.beginPath();
          ctx.arc(effect.x + effect.width / 2, effect.y + effect.height / 2, effect.width / 2, 0, 2 * Math.PI);
          ctx.fill();
        } else if (effect.shape === 'square') {
          ctx.fillRect(effect.x, effect.y, effect.width, effect.height);
        }
        
        ctx.globalAlpha = 1;
      });

      // Draw tokens
      tokens.forEach(token => {
        if (!token.isVisible) return;

        const tokenSize = token.size * gridSize;
        const x = token.x * gridSize;
        const y = token.y * gridSize;

        // Token background
        ctx.fillStyle = token.color;
        ctx.beginPath();
        ctx.arc(x + tokenSize / 2, y + tokenSize / 2, tokenSize / 2, 0, 2 * Math.PI);
        ctx.fill();

        // Token border
        ctx.strokeStyle = selectedToken === token.id ? '#ff6b6b' : '#343a40';
        ctx.lineWidth = selectedToken === token.id ? 3 : 2;
        ctx.stroke();

        // Token name
        ctx.fillStyle = '#ffffff';
        ctx.font = `${Math.max(10, tokenSize / 4)}px Arial`;
        ctx.textAlign = 'center';
        ctx.fillText(token.name.substring(0, 3), x + tokenSize / 2, y + tokenSize / 2 + 4);

        // HP indicator if damaged
        if (token.hp !== undefined && token.maxHp !== undefined && token.hp < token.maxHp) {
          const hpPercent = token.hp / token.maxHp;
          ctx.fillStyle = hpPercent > 0.5 ? '#28a745' : hpPercent > 0.25 ? '#ffc107' : '#dc3545';
          ctx.fillRect(x, y - 8, tokenSize * hpPercent, 4);
          
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 1;
          ctx.strokeRect(x, y - 8, tokenSize, 4);
        }

        // Condition indicators
        if (token.conditions.length > 0) {
          token.conditions.forEach((condition, index) => {
            ctx.fillStyle = '#dc3545';
            ctx.beginPath();
            ctx.arc(x + tokenSize - 5, y + 5 + (index * 8), 3, 0, 2 * Math.PI);
            ctx.fill();
          });
        }
      });
    }

    ctx.restore();
  }, [tokens, effects, fogRegions, selectedToken, showGrid, gridSize, mapImage, scale, offset]);

  // Canvas mouse handlers
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left - offset.x) / scale;
    const y = (e.clientY - rect.top - offset.y) / scale;

    if (selectedTool === 'move') {
      // Select token at position
      const clickedToken = tokens.find(token => {
        const tokenX = token.x * gridSize;
        const tokenY = token.y * gridSize;
        const tokenSize = token.size * gridSize;
        return x >= tokenX && x <= tokenX + tokenSize && y >= tokenY && y <= tokenY + tokenSize;
      });
      
      setSelectedToken(clickedToken?.id || null);
    } else if (selectedTool === 'fog') {
      // Toggle fog of war
      const gridX = Math.floor(x / gridSize);
      const gridY = Math.floor(y / gridSize);
      updateFogMutation.mutate({
        x: gridX * gridSize,
        y: gridY * gridSize,
        revealed: true
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging || !selectedToken) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left - offset.x) / scale;
    const y = (e.clientY - rect.top - offset.y) / scale;

    const gridX = Math.floor(x / gridSize);
    const gridY = Math.floor(y / gridSize);

    updateTokenMutation.mutate({
      tokenId: selectedToken,
      updates: { x: gridX, y: gridY }
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadMapMutation.mutate(file);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Shared Battle Map</h3>
        <div className="flex items-center space-x-2">
          <Badge variant="secondary">
            {tokens.filter(t => t.isVisible).length} Tokens
          </Badge>
          <Badge variant="outline">
            Scale: {Math.round(scale * 100)}%
          </Badge>
        </div>
      </div>

      {/* Toolbar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Tabs value={selectedTool} onValueChange={(value) => setSelectedTool(value as any)}>
                <TabsList>
                  <TabsTrigger value="move" className="text-xs">
                    <Move className="h-3 w-3 mr-1" />
                    Move
                  </TabsTrigger>
                  <TabsTrigger value="token" className="text-xs">
                    <Users className="h-3 w-3 mr-1" />
                    Token
                  </TabsTrigger>
                  <TabsTrigger value="effect" className="text-xs">
                    <Zap className="h-3 w-3 mr-1" />
                    Effect
                  </TabsTrigger>
                  <TabsTrigger value="fog" className="text-xs">
                    <Eye className="h-3 w-3 mr-1" />
                    Fog
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowGrid(!showGrid)}
              >
                <Grid3X3 className="h-4 w-4 mr-1" />
                Grid
              </Button>

              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
                id="map-upload"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => document.getElementById('map-upload')?.click()}
              >
                <Upload className="h-4 w-4 mr-1" />
                Upload Map
              </Button>
            </div>

            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setScale(Math.max(0.5, scale - 0.1))}
              >
                -
              </Button>
              <span className="text-sm w-16 text-center">{Math.round(scale * 100)}%</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setScale(Math.min(2, scale + 0.1))}
              >
                +
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Battle Map Canvas */}
      <Card>
        <CardContent className="p-2">
          <canvas
            ref={canvasRef}
            width={800}
            height={600}
            className="border rounded cursor-crosshair"
            onClick={handleCanvasClick}
            onMouseMove={handleMouseMove}
            onMouseDown={() => setIsDragging(true)}
            onMouseUp={() => setIsDragging(false)}
            onMouseLeave={() => setIsDragging(false)}
          />
        </CardContent>
      </Card>

      {/* Token List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Map Tokens</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {tokens.map(token => (
            <div
              key={token.id}
              className={`flex items-center justify-between p-2 rounded border ${
                selectedToken === token.id ? 'border-primary bg-primary/5' : ''
              }`}
            >
              <div className="flex items-center space-x-2">
                <div
                  className="w-4 h-4 rounded-full border"
                  style={{ backgroundColor: token.color }}
                />
                <span className="text-sm font-medium">{token.name}</span>
                <Badge variant="outline" className="text-xs">
                  {token.type}
                </Badge>
                {!token.isVisible && (
                  <Badge variant="secondary" className="text-xs">
                    Hidden
                  </Badge>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <span className="text-xs text-muted-foreground">
                  ({token.x}, {token.y})
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => 
                    updateTokenMutation.mutate({
                      tokenId: token.id,
                      updates: { isVisible: !token.isVisible }
                    })
                  }
                >
                  {token.isVisible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}