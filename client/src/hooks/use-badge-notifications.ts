import { useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { identifyUser } from "@/lib/websocket";

/**
 * Listens for badge_unlocked WebSocket events and shows a toast notification.
 * Also identifies the authenticated user to the server so targeted WS broadcasts work.
 * Mount once at the app root (inside AuthProvider).
 */
export function useBadgeNotifications() {
  const { toast } = useToast();
  const { user } = useAuth();

  // Register this user's socket connection so the server can send targeted messages
  useEffect(() => {
    if (!user?.id) return;
    identifyUser(user.id);
  }, [user?.id]);

  // Listen for badge unlock events
  useEffect(() => {
    function handleBadgeUnlocked(e: Event) {
      const badge = (e as CustomEvent).detail;
      if (!badge) return;
      toast({
        title: `🏅 Badge Unlocked: ${badge.name}`,
        description: badge.description || "A new milestone reached.",
        duration: 6000,
      });
    }

    window.addEventListener("badge_unlocked", handleBadgeUnlocked);
    return () => window.removeEventListener("badge_unlocked", handleBadgeUnlocked);
  }, [toast]);
}
