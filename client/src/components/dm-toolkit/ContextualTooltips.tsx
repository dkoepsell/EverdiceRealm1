import { useState, useEffect } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  HelpCircle, 
  Info, 
  Lightbulb, 
  Target,
  Clock,
  Users,
  Zap,
  X
} from "lucide-react";

interface TooltipConfig {
  id: string;
  element: string;
  title: string;
  content: string;
  position: 'top' | 'bottom' | 'left' | 'right';
  trigger: 'hover' | 'click' | 'auto';
  importance: 'low' | 'medium' | 'high';
  showOnce?: boolean;
  delay?: number;
}

interface ContextualTooltipsProps {
  currentTab: string;
  selectedCampaignId: number | null;
  isFirstTime?: boolean;
}

export default function ContextualTooltips({ currentTab, selectedCampaignId, isFirstTime = false }: ContextualTooltipsProps) {
  const [activeTooltips, setActiveTooltips] = useState<Set<string>>(new Set());
  const [dismissedTooltips, setDismissedTooltips] = useState<Set<string>>(new Set());
  const [showHelpMode, setShowHelpMode] = useState(false);

  // Contextual tooltips for different tabs and states
  const tooltipConfigs: TooltipConfig[] = [
    // Live Manager
    {
      id: "live-manager-start",
      element: "[data-tooltip='start-session']",
      title: "Start Your Session",
      content: "Click here to begin recording your session and activate real-time features for your players.",
      position: "bottom",
      trigger: "hover",
      importance: "high"
    },
    {
      id: "campaign-selection",
      element: "[data-tooltip='campaign-select']",
      title: "Select Active Campaign",
      content: "Choose which campaign you're running today. This will load all associated characters, story arcs, and session history.",
      position: "right",
      trigger: "hover",
      importance: "medium"
    },

    // Player Dashboard
    {
      id: "player-dashboard-overview",
      element: "[data-tooltip='player-status']",
      title: "Real-Time Player Monitoring",
      content: "Monitor all player character stats, conditions, and resources in real-time. Updates automatically as players make changes.",
      position: "top",
      trigger: "hover",
      importance: "medium"
    },
    {
      id: "quick-health-adjust",
      element: "[data-tooltip='health-controls']",
      title: "Quick Health Adjustment",
      content: "Quickly adjust player HP with +/- buttons. Perfect for damage dealing or healing during combat.",
      position: "left",
      trigger: "hover",
      importance: "high"
    },

    // Initiative Tracker - removed auto-trigger to prevent unwanted popups
    {
      id: "next-turn",
      element: "[data-tooltip='next-turn']",
      title: "Advance Turn",
      content: "Move to the next character's turn. This will notify all players and update the active turn indicator.",
      position: "top",
      trigger: "hover",
      importance: "medium"
    },

    // Battle Map
    {
      id: "battle-map-tokens",
      element: "[data-tooltip='token-placement']",
      title: "Token Management",
      content: "Drag and drop character tokens to position them on the battlefield. Players can see movements in real-time.",
      position: "right",
      trigger: "hover",
      importance: "medium"
    },
    {
      id: "fog-of-war",
      element: "[data-tooltip='fog-controls']",
      title: "Fog of War",
      content: "Control what areas players can see by drawing fog of war regions. Reveal areas as they explore.",
      position: "bottom",
      trigger: "hover",
      importance: "low"
    },

    // Audio/Visual
    {
      id: "ambient-music",
      element: "[data-tooltip='music-controls']",
      title: "Atmosphere Control",
      content: "Set the mood with ambient music and sound effects. Different tracks for exploration, combat, and social encounters.",
      position: "top",
      trigger: "hover",
      importance: "low"
    },

    // Session Recording - removed auto-trigger to prevent unwanted popups
    {
      id: "bookmark-moments",
      element: "[data-tooltip='add-bookmark']",
      title: "Bookmark Key Moments",
      content: "Mark important story beats, epic dice rolls, or memorable roleplay moments for easy reference later.",
      position: "left",
      trigger: "hover",
      importance: "low"
    },

    // Voice Integration
    {
      id: "voice-commands",
      element: "[data-tooltip='voice-enable']",
      title: "Voice Commands",
      content: "Enable hands-free control with voice commands like 'roll d20', 'next turn', or 'start combat'.",
      position: "top",
      trigger: "hover",
      importance: "low"
    },

    // Character Sync
    {
      id: "character-sync-live",
      element: "[data-tooltip='sync-status']",
      title: "Live Character Sync",
      content: "See real-time updates of player character sheets. Monitor HP, spell slots, and conditions automatically.",
      position: "right",
      trigger: "hover",
      importance: "high"
    },

    // First-time user tooltips
    {
      id: "first-time-welcome",
      element: "[data-tooltip='dm-toolkit']",
      title: "Welcome to DM Toolkit!",
      content: "This comprehensive toolkit helps you run amazing D&D sessions. Start by creating or selecting a campaign, then follow the guided workflow.",
      position: "bottom",
      trigger: "auto",
      importance: "high",
      showOnce: true,
      delay: 1000
    }
  ];

  // Get relevant tooltips for current context
  const getRelevantTooltips = () => {
    let relevant = tooltipConfigs.filter(tooltip => {
      // Filter by current tab
      if (currentTab === 'live-manager' && !tooltip.id.includes('live-manager') && !tooltip.id.includes('first-time')) return false;
      if (currentTab === 'player-dashboard' && !tooltip.id.includes('player-dashboard')) return false;
      if (currentTab === 'initiative' && !tooltip.id.includes('initiative')) return false;
      if (currentTab === 'battle-map' && !tooltip.id.includes('battle-map')) return false;
      if (currentTab === 'audio-visual' && !tooltip.id.includes('ambient')) return false;
      if (currentTab === 'session-recording' && !tooltip.id.includes('session-recording') && !tooltip.id.includes('bookmark')) return false;
      if (currentTab === 'voice-control' && !tooltip.id.includes('voice')) return false;
      if (currentTab === 'character-sync' && !tooltip.id.includes('character-sync')) return false;

      // Show campaign selection if no campaign selected
      if (!selectedCampaignId && tooltip.id === 'campaign-selection') return true;
      if (selectedCampaignId && tooltip.id === 'campaign-selection') return false;

      // Show first-time tooltips only for new users
      if (tooltip.id.includes('first-time') && !isFirstTime) return false;

      return true;
    });

    // Filter out dismissed tooltips
    relevant = relevant.filter(tooltip => !dismissedTooltips.has(tooltip.id));

    return relevant;
  };

  // Auto-show tooltips based on trigger
  useEffect(() => {
    const relevantTooltips = getRelevantTooltips();
    
    relevantTooltips.forEach(tooltip => {
      if (tooltip.trigger === 'auto' && !activeTooltips.has(tooltip.id)) {
        const timer = setTimeout(() => {
          setActiveTooltips(prev => new Set([...prev, tooltip.id]));
        }, tooltip.delay || 0);

        return () => clearTimeout(timer);
      }
    });
  }, [currentTab, selectedCampaignId, isFirstTime]);

  const dismissTooltip = (tooltipId: string) => {
    setActiveTooltips(prev => {
      const newSet = new Set(prev);
      newSet.delete(tooltipId);
      return newSet;
    });
    setDismissedTooltips(prev => new Set([...prev, tooltipId]));
  };

  const toggleHelpMode = () => {
    setShowHelpMode(!showHelpMode);
    if (!showHelpMode) {
      // Show all relevant tooltips in help mode
      const relevant = getRelevantTooltips();
      setActiveTooltips(new Set(relevant.map(t => t.id)));
    } else {
      // Hide all tooltips when exiting help mode
      setActiveTooltips(new Set());
    }
  };

  // Floating Help Button
  const HelpModeButton = () => (
    <div className="fixed bottom-4 right-4 z-50">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="lg"
              variant={showHelpMode ? "default" : "outline"}
              onClick={toggleHelpMode}
              className={`rounded-full h-12 w-12 shadow-lg ${
                showHelpMode ? 'bg-blue-600 hover:bg-blue-700' : ''
              }`}
            >
              {showHelpMode ? <X className="h-5 w-5" /> : <HelpCircle className="h-5 w-5" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">
            <p>{showHelpMode ? 'Exit Help Mode' : 'Show Contextual Help'}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );

  // Smart Tooltip Component
  const SmartTooltip = ({ config }: { config: TooltipConfig }) => {
    const isActive = activeTooltips.has(config.id) || showHelpMode;
    
    if (!isActive) return null;

    const getIcon = () => {
      switch (config.importance) {
        case 'high': return <Target className="h-4 w-4 text-red-500" />;
        case 'medium': return <Info className="h-4 w-4 text-blue-500" />;
        case 'low': return <Lightbulb className="h-4 w-4 text-yellow-500" />;
      }
    };

    return (
      <div 
        className="fixed z-40 pointer-events-auto"
        style={{
          // Position based on element (simplified - in real implementation would calculate from DOM element)
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)'
        }}
      >
        <Card className={`max-w-xs shadow-lg border-2 ${
          config.importance === 'high' ? 'border-red-200 bg-red-50' :
          config.importance === 'medium' ? 'border-blue-200 bg-blue-50' :
          'border-yellow-200 bg-yellow-50'
        }`}>
          <CardContent className="p-4">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 mt-1">
                {getIcon()}
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-sm mb-1">{config.title}</h4>
                <p className="text-xs text-muted-foreground mb-3">{config.content}</p>
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-xs">
                    {config.importance} priority
                  </Badge>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => dismissTooltip(config.id)}
                    className="h-6 w-6 p-0"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  // Tutorial Overlay for Help Mode
  const TutorialOverlay = () => {
    if (!showHelpMode) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-30 pointer-events-none">
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 pointer-events-auto">
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="p-4 text-center">
              <div className="flex items-center space-x-2">
                <Info className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-900">Help Mode Active</span>
              </div>
              <p className="text-xs text-blue-700 mt-1">
                Contextual help tips are now visible. Click the help button again to exit.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  };

  // Progress Indicator for First-Time Users
  const FirstTimeProgress = () => {
    if (!isFirstTime) return null;

    const totalSteps = 5;
    const completedSteps = selectedCampaignId ? 1 : 0;

    return (
      <div className="fixed top-4 right-20 z-40">
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-3">
            <div className="flex items-center space-x-2">
              <Users className="h-4 w-4 text-green-600" />
              <div className="text-xs">
                <div className="font-medium text-green-900">Setup Progress</div>
                <div className="text-green-700">{completedSteps}/{totalSteps} steps complete</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <TooltipProvider>
      {/* Render active tooltips */}
      {getRelevantTooltips().map(config => (
        <SmartTooltip key={config.id} config={config} />
      ))}

      {/* Help mode overlay */}
      <TutorialOverlay />

      {/* First-time user progress */}
      <FirstTimeProgress />

      {/* Floating help button */}
      <HelpModeButton />

      {/* Quick Tips Panel (when in help mode) */}
      {showHelpMode && (
        <div className="fixed top-1/2 left-4 transform -translate-y-1/2 z-40 max-w-xs">
          <Card>
            <CardHeader className="pb-2">
              <h3 className="text-sm font-semibold flex items-center space-x-2">
                <Lightbulb className="h-4 w-4" />
                <span>Quick Tips for {currentTab}</span>
              </h3>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2 text-xs">
                {currentTab === 'live-manager' && (
                  <>
                    <p>• Select an active campaign to begin</p>
                    <p>• Use the workflow guide for step-by-step help</p>
                    <p>• Start session recording before play begins</p>
                  </>
                )}
                {currentTab === 'player-dashboard' && (
                  <>
                    <p>• Monitor all player stats in real-time</p>
                    <p>• Use quick +/- buttons for health changes</p>
                    <p>• Track conditions and spell slots automatically</p>
                  </>
                )}
                {currentTab === 'initiative' && (
                  <>
                    <p>• Add all combatants before starting</p>
                    <p>• Use "Next Turn" to advance automatically</p>
                    <p>• Track conditions per character</p>
                  </>
                )}
                {currentTab === 'battle-map' && (
                  <>
                    <p>• Upload or draw battle maps</p>
                    <p>• Drag tokens to move characters</p>
                    <p>• Use fog of war for exploration</p>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </TooltipProvider>
  );
}