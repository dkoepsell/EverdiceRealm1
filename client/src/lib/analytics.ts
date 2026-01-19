import { apiRequest } from "./queryClient";

const SESSION_ID_KEY = "everdice_session_id";

function getSessionId(): string {
  let sessionId = sessionStorage.getItem(SESSION_ID_KEY);
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem(SESSION_ID_KEY, sessionId);
  }
  return sessionId;
}

function getDeviceType(): string {
  const ua = navigator.userAgent;
  if (/tablet|ipad|playbook|silk/i.test(ua)) return "tablet";
  if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(ua)) return "mobile";
  return "desktop";
}

function getBrowserInfo(): string {
  const ua = navigator.userAgent;
  if (ua.includes("Chrome")) return "Chrome";
  if (ua.includes("Firefox")) return "Firefox";
  if (ua.includes("Safari")) return "Safari";
  if (ua.includes("Edge")) return "Edge";
  return "Other";
}

export async function trackSession(): Promise<void> {
  try {
    await apiRequest("POST", "/api/analytics/session", {
      sessionId: getSessionId(),
      deviceType: getDeviceType(),
      browserInfo: getBrowserInfo()
    });
  } catch (error) {
    // Silent fail - don't block user experience
  }
}

export async function trackEvent(
  eventCategory: string,
  eventName: string,
  eventData?: Record<string, any>,
  options?: {
    campaignId?: number;
    characterId?: number;
    duration?: number;
  }
): Promise<void> {
  try {
    await apiRequest("POST", "/api/analytics/event", {
      sessionId: getSessionId(),
      eventType: "interaction",
      eventCategory,
      eventName,
      eventData: eventData || {},
      pageUrl: window.location.pathname,
      campaignId: options?.campaignId,
      characterId: options?.characterId,
      duration: options?.duration
    });
  } catch (error) {
    // Silent fail - don't block user experience
  }
}

export async function trackPageView(pageName: string): Promise<void> {
  return trackEvent("navigation", "page_view", { page: pageName });
}

export async function trackFeatureUse(featureName: string, data?: Record<string, any>): Promise<void> {
  return trackEvent("feature", featureName, data);
}

export async function trackCampaignAction(
  action: string, 
  campaignId: number, 
  data?: Record<string, any>
): Promise<void> {
  return trackEvent("campaign", action, data, { campaignId });
}

export async function trackCharacterAction(
  action: string, 
  characterId: number, 
  data?: Record<string, any>
): Promise<void> {
  return trackEvent("character", action, data, { characterId });
}
