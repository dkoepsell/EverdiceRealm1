import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Sparkles, 
  Users, 
  X,
  Play,
  UserPlus,
  Gamepad2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";

interface ReturnVisitorPromptProps {
  userName?: string;
  hasSoloSession?: boolean;
  onDismiss: () => void;
}

export function ReturnVisitorPrompt({ userName, hasSoloSession, onDismiss }: ReturnVisitorPromptProps) {
  const [isVisible, setIsVisible] = useState(false);
  
  useEffect(() => {
    const visitCount = parseInt(localStorage.getItem('everdice_visit_count') || '0');
    const lastPromptDate = localStorage.getItem('everdice_last_mode_prompt');
    const today = new Date().toDateString();
    
    localStorage.setItem('everdice_visit_count', (visitCount + 1).toString());
    
    if (visitCount >= 1 && visitCount <= 5 && lastPromptDate !== today && hasSoloSession) {
      setTimeout(() => setIsVisible(true), 2000);
      localStorage.setItem('everdice_last_mode_prompt', today);
    }
  }, [hasSoloSession]);

  const handleDismiss = () => {
    setIsVisible(false);
    onDismiss();
  };

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="mb-6"
      >
        <Card className="border-2 border-primary/20 bg-gradient-to-r from-amber-500/5 via-orange-500/5 to-amber-500/5 overflow-hidden">
          <CardContent className="py-4 px-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-sm mb-1">
                    Welcome back{userName ? `, ${userName}` : ''}!
                  </h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Last time you played solo. Want to try something new today?
                  </p>
                  
                  <div className="flex flex-wrap gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="text-xs h-8"
                      onClick={handleDismiss}
                    >
                      <Play className="h-3 w-3 mr-1.5" />
                      Continue Solo
                    </Button>
                    
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="text-xs h-8 border-amber-500/30 hover:bg-amber-500/10"
                      onClick={handleDismiss}
                    >
                      <UserPlus className="h-3 w-3 mr-1.5" />
                      Add AI Party
                    </Button>
                    
                    <Link href="/campaigns">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="text-xs h-8 border-blue-500/30 hover:bg-blue-500/10"
                        onClick={handleDismiss}
                      >
                        <Users className="h-3 w-3 mr-1.5" />
                        Join a Game
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
              
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-7 w-7 text-muted-foreground hover:text-foreground flex-shrink-0"
                onClick={handleDismiss}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
}

export function GhostPartyPrompt({ onAddCompanion, onDismiss }: { onAddCompanion: () => void; onDismiss: () => void }) {
  const [isVisible, setIsVisible] = useState(false);
  
  useEffect(() => {
    const soloSessionCount = parseInt(localStorage.getItem('everdice_solo_sessions') || '0');
    const hasSeenGhostPrompt = localStorage.getItem('everdice_seen_ghost_prompt');
    
    if (soloSessionCount >= 2 && !hasSeenGhostPrompt) {
      setTimeout(() => setIsVisible(true), 3000);
    }
  }, []);

  const handleDismiss = () => {
    localStorage.setItem('everdice_seen_ghost_prompt', 'true');
    setIsVisible(false);
    onDismiss();
  };

  const handleAddCompanion = () => {
    localStorage.setItem('everdice_seen_ghost_prompt', 'true');
    setIsVisible(false);
    onAddCompanion();
  };

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        onClick={handleDismiss}
      >
        <motion.div
          initial={{ y: 20 }}
          animate={{ y: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          <Card className="max-w-md border-2 border-amber-500/30 bg-card shadow-2xl">
            <CardContent className="pt-6 pb-5">
              <div className="text-center mb-5">
                <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                  <Users className="h-7 w-7 text-white" />
                </div>
                <h3 className="text-xl font-bold mb-2">Want Some Help?</h3>
                <p className="text-muted-foreground text-sm">
                  You've been adventuring solo. Add AI companions to your adventure:
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-5">
                {[
                  { name: "Fighter", desc: "Tank & Protection", color: "from-red-500 to-orange-500" },
                  { name: "Rogue", desc: "Stealth & Skills", color: "from-slate-500 to-zinc-600" },
                  { name: "Cleric", desc: "Healing & Support", color: "from-blue-500 to-cyan-500" }
                ].map((comp) => (
                  <div 
                    key={comp.name}
                    className={`p-3 rounded-lg bg-gradient-to-br ${comp.color}/10 border border-current/20 text-center`}
                  >
                    <p className="font-semibold text-sm">{comp.name}</p>
                    <p className="text-xs text-muted-foreground">{comp.desc}</p>
                  </div>
                ))}
              </div>

              <div className="text-center text-xs text-muted-foreground mb-4">
                <p>No scheduling. No social anxiety. No rules overload.</p>
                <p className="mt-1 text-amber-600">These companions can be replaced with real players later.</p>
              </div>

              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={handleDismiss}
                >
                  Maybe Later
                </Button>
                <Button 
                  className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
                  onClick={handleAddCompanion}
                >
                  Add Companions
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
