import { useEffect, useCallback, useRef } from 'react';
import { useAuth } from './use-auth';

const SESSION_KEY = 'everdice_session_id';

function generateSessionId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

function getSessionId(): string {
  let sessionId = sessionStorage.getItem(SESSION_KEY);
  if (!sessionId) {
    sessionId = generateSessionId();
    sessionStorage.setItem(SESSION_KEY, sessionId);
  }
  return sessionId;
}

function getDeviceType(): string {
  const ua = navigator.userAgent;
  if (/tablet|ipad|playbook|silk/i.test(ua)) return 'tablet';
  if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(ua)) return 'mobile';
  return 'desktop';
}

export function useAnalytics() {
  const { user } = useAuth();
  const sessionStarted = useRef(false);

  const trackEvent = useCallback(async (
    eventType: string,
    eventCategory: string,
    eventName: string,
    eventData?: Record<string, unknown>,
    campaignId?: number,
    characterId?: number
  ) => {
    if (!user) return;
    
    try {
      await fetch('/api/analytics/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: getSessionId(),
          eventType,
          eventCategory,
          eventName,
          eventData,
          pageUrl: window.location.pathname,
          campaignId,
          characterId
        })
      });
    } catch (error) {
      // Silently fail - analytics should never break the app
    }
  }, [user]);

  const trackPageView = useCallback((pageName: string) => {
    trackEvent('page_view', 'navigation', pageName);
  }, [trackEvent]);

  const trackFeatureUse = useCallback((featureName: string, data?: Record<string, unknown>) => {
    trackEvent('feature_use', 'features', featureName, data);
  }, [trackEvent]);

  const trackCampaignAction = useCallback((action: string, campaignId: number, data?: Record<string, unknown>) => {
    trackEvent('campaign_action', 'gameplay', action, data, campaignId);
  }, [trackEvent]);

  const trackCharacterAction = useCallback((action: string, characterId: number, data?: Record<string, unknown>) => {
    trackEvent('character_action', 'character_mgmt', action, data, undefined, characterId);
  }, [trackEvent]);

  const trackDMToolUse = useCallback((tool: string, data?: Record<string, unknown>) => {
    trackEvent('dm_tool_use', 'dm_tools', tool, data);
  }, [trackEvent]);

  const trackAIRequest = useCallback((type: string, data?: Record<string, unknown>) => {
    trackEvent('ai_request', 'ai', type, data);
  }, [trackEvent]);

  const trackDiceRoll = useCallback((diceType: string, result: number, purpose?: string) => {
    trackEvent('dice_roll', 'gameplay', `roll_${diceType}`, { result, purpose });
  }, [trackEvent]);

  const trackCombatAction = useCallback((action: string, data?: Record<string, unknown>) => {
    trackEvent('combat_action', 'combat', action, data);
  }, [trackEvent]);

  // Start session tracking when user logs in
  useEffect(() => {
    if (!user || sessionStarted.current) return;
    
    const startSession = async () => {
      try {
        await fetch('/api/analytics/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: getSessionId(),
            deviceType: getDeviceType(),
            browserInfo: navigator.userAgent.substring(0, 200)
          })
        });
        sessionStarted.current = true;
      } catch (error) {
        // Silently fail
      }
    };
    
    startSession();

    // Update session periodically to track duration
    const interval = setInterval(() => {
      fetch('/api/analytics/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: getSessionId(),
          deviceType: getDeviceType(),
          browserInfo: navigator.userAgent.substring(0, 200)
        })
      }).catch(() => {});
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [user]);

  return {
    trackEvent,
    trackPageView,
    trackFeatureUse,
    trackCampaignAction,
    trackCharacterAction,
    trackDMToolUse,
    trackAIRequest,
    trackDiceRoll,
    trackCombatAction
  };
}
