import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { X, Flame, MessageSquare, Users, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

const REMINDER_INTERVAL_MS = 120 * 60 * 1000; // Show every 2 hours
const LAST_SHOWN_KEY = 'hearth_reminder_last_shown';

export function HearthReminder() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const checkAndShowReminder = () => {
      const lastShown = localStorage.getItem(LAST_SHOWN_KEY);
      const now = Date.now();
      
      if (!lastShown || (now - parseInt(lastShown)) > REMINDER_INTERVAL_MS) {
        // Add a random delay (30-90 seconds) so it doesn't appear immediately
        const delay = Math.random() * 60000 + 30000;
        setTimeout(() => {
          setIsVisible(true);
          localStorage.setItem(LAST_SHOWN_KEY, now.toString());
        }, delay);
      }
    };

    checkAndShowReminder();
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm animate-in slide-in-from-bottom-5 fade-in duration-500">
      <div className="bg-gradient-to-br from-amber-900 via-orange-900 to-red-900 rounded-xl shadow-2xl border border-amber-500/50 overflow-hidden">
        <div className="relative p-4">
          <button
            onClick={handleDismiss}
            className="absolute top-2 right-2 text-amber-300/70 hover:text-amber-100 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
          
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-500/20 rounded-lg">
              <Flame className="h-8 w-8 text-amber-400 animate-pulse" />
            </div>
            
            <div className="flex-1 pr-4">
              <h3 className="font-bold text-amber-200 flex items-center gap-1">
                <Sparkles className="h-4 w-4" />
                Visit the Hearth
              </h3>
              <p className="text-sm text-amber-100/80 mt-1">
                Take a break at the Hearth! Chat with fellow adventurers, leave notes, and relax by the fire.
              </p>
              
              <div className="flex items-center gap-4 mt-3 text-xs text-amber-300/70">
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" /> Community
                </span>
                <span className="flex items-center gap-1">
                  <MessageSquare className="h-3 w-3" /> Notes
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex gap-2 mt-4">
            <Link href="/hearth" className="flex-1">
              <Button 
                className="w-full bg-amber-600 hover:bg-amber-500 text-white"
                onClick={handleDismiss}
              >
                <Flame className="h-4 w-4 mr-2" />
                Enter the Hearth
              </Button>
            </Link>
            <Button 
              variant="ghost" 
              className="text-amber-300 hover:text-amber-100 hover:bg-amber-800/50"
              onClick={handleDismiss}
            >
              Later
            </Button>
          </div>
        </div>
        
        <div className="h-1 bg-gradient-to-r from-amber-500 via-orange-500 to-red-500" />
      </div>
    </div>
  );
}
