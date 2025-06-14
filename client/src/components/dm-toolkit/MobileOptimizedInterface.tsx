import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Smartphone,
  Users,
  Target,
  Map,
  Dice6,
  Volume2,
  Settings,
  Maximize2,
  Minimize2,
  RefreshCw,
  Wifi,
  WifiOff
} from "lucide-react";

interface MobileOptimizedInterfaceProps {
  campaignId: number;
  children?: React.ReactNode;
}

export default function MobileOptimizedInterface({ campaignId, children }: MobileOptimizedInterfaceProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [touchSupported, setTouchSupported] = useState(false);
  const [screenSize, setScreenSize] = useState({ width: 0, height: 0 });

  // Mobile detection and optimization
  useEffect(() => {
    const checkMobileFeatures = () => {
      // Check touch support
      setTouchSupported('ontouchstart' in window || navigator.maxTouchPoints > 0);
      
      // Check screen size
      setScreenSize({
        width: window.innerWidth,
        height: window.innerHeight
      });
      
      // Check orientation
      setOrientation(window.innerWidth > window.innerHeight ? 'landscape' : 'portrait');
    };

    // Initial check
    checkMobileFeatures();

    // Event listeners
    const handleResize = () => {
      checkMobileFeatures();
    };

    const handleOrientationChange = () => {
      setTimeout(checkMobileFeatures, 100); // Delay to ensure accurate measurements
    };

    const handleOnlineStatus = () => {
      setIsOnline(navigator.onLine);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleOrientationChange);
    window.addEventListener('online', handleOnlineStatus);
    window.addEventListener('offline', handleOnlineStatus);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleOrientationChange);
      window.removeEventListener('online', handleOnlineStatus);
      window.removeEventListener('offline', handleOnlineStatus);
    };
  }, []);

  // Mobile-specific optimizations
  const isMobile = screenSize.width < 768;
  const isTablet = screenSize.width >= 768 && screenSize.width < 1024;
  const isDesktop = screenSize.width >= 1024;

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      try {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      } catch (error) {
        console.error('Error entering fullscreen:', error);
      }
    } else {
      try {
        await document.exitFullscreen();
        setIsFullscreen(false);
      } catch (error) {
        console.error('Error exiting fullscreen:', error);
      }
    }
  };

  const refreshApp = () => {
    window.location.reload();
  };

  return (
    <div className="space-y-4">
      {/* Mobile Status Bar */}
      <Card className="lg:hidden">
        <CardContent className="p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Badge variant={isOnline ? "default" : "destructive"} className="text-xs">
                {isOnline ? (
                  <><Wifi className="h-3 w-3 mr-1" /> Online</>
                ) : (
                  <><WifiOff className="h-3 w-3 mr-1" /> Offline</>
                )}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                <Smartphone className="h-3 w-3 mr-1" />
                {isMobile ? 'Mobile' : isTablet ? 'Tablet' : 'Desktop'}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {orientation === 'portrait' ? '📱' : '📱→'}
                {screenSize.width}×{screenSize.height}
              </Badge>
            </div>
            
            <div className="flex items-center space-x-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={refreshApp}
                className="h-8 w-8 p-0"
              >
                <RefreshCw className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={toggleFullscreen}
                className="h-8 w-8 p-0"
              >
                {isFullscreen ? (
                  <Minimize2 className="h-3 w-3" />
                ) : (
                  <Maximize2 className="h-3 w-3" />
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Mobile Quick Actions */}
      {isMobile && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" className="h-12 flex-col">
                <Dice6 className="h-4 w-4 mb-1" />
                <span className="text-xs">Roll d20</span>
              </Button>
              <Button variant="outline" size="sm" className="h-12 flex-col">
                <Target className="h-4 w-4 mb-1" />
                <span className="text-xs">Initiative</span>
              </Button>
              <Button variant="outline" size="sm" className="h-12 flex-col">
                <Users className="h-4 w-4 mb-1" />
                <span className="text-xs">Players</span>
              </Button>
              <Button variant="outline" size="sm" className="h-12 flex-col">
                <Volume2 className="h-4 w-4 mb-1" />
                <span className="text-xs">Audio</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Mobile-Optimized Tabs */}
      {isMobile && (
        <Tabs defaultValue="dashboard" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="dashboard" className="text-xs">
              <Users className="h-3 w-3" />
            </TabsTrigger>
            <TabsTrigger value="combat" className="text-xs">
              <Target className="h-3 w-3" />
            </TabsTrigger>
            <TabsTrigger value="map" className="text-xs">
              <Map className="h-3 w-3" />
            </TabsTrigger>
            <TabsTrigger value="tools" className="text-xs">
              <Settings className="h-3 w-3" />
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Player Dashboard</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-xs text-muted-foreground">
                  Real-time player status and character sheets optimized for mobile viewing
                </div>
                <div className="grid grid-cols-1 gap-2">
                  <div className="p-2 border rounded">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-sm">Thorne Ironfist</span>
                      <Badge variant="secondary" className="text-xs">Level 5</Badge>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>HP: 42/45</span>
                      <span>AC: 18</span>
                    </div>
                  </div>
                  <div className="p-2 border rounded">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-sm">Lyra Moonwhisper</span>
                      <Badge variant="secondary" className="text-xs">Level 4</Badge>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>HP: 28/32</span>
                      <span>AC: 14</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="combat" className="space-y-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Initiative Tracker</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-xs text-muted-foreground">
                  Combat initiative and turn management
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between p-2 bg-primary/10 rounded">
                    <span className="font-medium text-sm">Lyra (19)</span>
                    <Badge variant="default" className="text-xs">Current</Badge>
                  </div>
                  <div className="flex items-center justify-between p-2 border rounded">
                    <span className="text-sm">Orc Warrior (15)</span>
                    <Badge variant="outline" className="text-xs">Enemy</Badge>
                  </div>
                  <div className="flex items-center justify-between p-2 border rounded">
                    <span className="text-sm">Thorne (12)</span>
                    <Badge variant="secondary" className="text-xs">Player</Badge>
                  </div>
                </div>
                <Button className="w-full" size="sm">
                  Next Turn
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="map" className="space-y-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Battle Map</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="aspect-square bg-muted rounded border-2 border-dashed flex items-center justify-center">
                  <div className="text-center">
                    <Map className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">
                      Touch and drag to move tokens
                    </p>
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-1">
                  <Button variant="outline" size="sm" className="text-xs">
                    Zoom In
                  </Button>
                  <Button variant="outline" size="sm" className="text-xs">
                    Center
                  </Button>
                  <Button variant="outline" size="sm" className="text-xs">
                    Zoom Out
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tools" className="space-y-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">DM Tools</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm" className="h-10 flex-col">
                    <Dice6 className="h-3 w-3 mb-1" />
                    <span className="text-xs">Dice</span>
                  </Button>
                  <Button variant="outline" size="sm" className="h-10 flex-col">
                    <Volume2 className="h-3 w-3 mb-1" />
                    <span className="text-xs">Audio</span>
                  </Button>
                </div>
                <div className="text-xs text-muted-foreground">
                  Additional tools available in full interface
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* Mobile Performance Tips */}
      {isMobile && !isOnline && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="p-3">
            <div className="flex items-center space-x-2">
              <WifiOff className="h-4 w-4 text-yellow-600" />
              <div className="text-sm">
                <p className="font-medium text-yellow-800">Offline Mode</p>
                <p className="text-yellow-700 text-xs">
                  Some features may be limited without internet connection
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Orientation Warning */}
      {isMobile && orientation === 'portrait' && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-3">
            <div className="text-center">
              <p className="text-sm font-medium text-blue-800">
                📱→ Rotate for Better Experience
              </p>
              <p className="text-xs text-blue-700">
                Some features work better in landscape mode
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content Area */}
      <div className={`${isMobile ? 'space-y-2' : 'space-y-4'}`}>
        {children}
      </div>
    </div>
  );
}