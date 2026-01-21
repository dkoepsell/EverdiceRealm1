import { apiRequest } from "./queryClient";

const SESSION_ID_KEY = "everdice_session_id";
const PAGE_ENTRY_KEY = "everdice_page_entry";

function getSessionId(): string {
  let sessionId = sessionStorage.getItem(SESSION_ID_KEY);
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem(SESSION_ID_KEY, sessionId);
  }
  return sessionId;
}

interface PageEntry {
  page: string;
  enteredAt: number;
}

function getPageEntry(): PageEntry | null {
  const entry = sessionStorage.getItem(PAGE_ENTRY_KEY);
  return entry ? JSON.parse(entry) : null;
}

function setPageEntry(page: string): void {
  sessionStorage.setItem(PAGE_ENTRY_KEY, JSON.stringify({
    page,
    enteredAt: Date.now()
  }));
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
  // First, track time spent on previous page if any
  const previousPage = getPageEntry();
  if (previousPage && previousPage.page !== pageName) {
    const timeSpent = Date.now() - previousPage.enteredAt;
    if (timeSpent > 1000) { // Only track if spent more than 1 second
      await trackEvent("navigation", "page_exit", { 
        page: previousPage.page,
        timeSpentMs: timeSpent,
        timeSpentSeconds: Math.round(timeSpent / 1000)
      }, { duration: timeSpent });
    }
  }
  
  // Set new page entry
  setPageEntry(pageName);
  
  return trackEvent("navigation", "page_view", { page: pageName });
}

export async function trackClick(
  elementType: string,
  elementId: string,
  elementText?: string,
  additionalData?: Record<string, any>
): Promise<void> {
  return trackEvent("interaction", "click", {
    elementType,
    elementId,
    elementText: elementText?.substring(0, 100),
    ...additionalData
  });
}

export async function trackButtonClick(buttonId: string, buttonText?: string): Promise<void> {
  return trackClick("button", buttonId, buttonText);
}

export async function trackLinkClick(linkHref: string, linkText?: string): Promise<void> {
  return trackClick("link", linkHref, linkText);
}

export async function trackTabChange(tabId: string, tabName: string): Promise<void> {
  return trackEvent("interaction", "tab_change", { tabId, tabName });
}

export async function trackScrollDepth(depth: number, pageName: string): Promise<void> {
  return trackEvent("interaction", "scroll", { depth, page: pageName });
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
