/**
 * Gentle, sparing email re-engagement.
 *
 * Philosophy (per product decision): email is a quiet tap on the shoulder, not
 * a drip campaign. We only ever reach out when there's a real reason to return
 * — a persisted cliffhanger from an unfinished adventure — and we cap how often
 * and how many times any one player hears from us.
 *
 * Guardrails:
 *  - Only users with an email address AND not opted out.
 *  - Only after MIN_IDLE_DAYS of no login.
 *  - At most one re-engagement email per MIN_GAP_DAYS.
 *  - At most MAX_LIFETIME per player, ever.
 *  - Nothing sends unless SMTP is configured (see email.ts) — safe by default.
 */
import { randomUUID } from "crypto";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { db } from "../db";
import { storage } from "../storage";
import {
  users,
  campaigns,
  campaignSessions,
  userActivityEvents,
  type User,
} from "@shared/schema";
import {
  mergeOnboardingState,
  parseOnboardingState,
  type OnboardingState,
} from "@shared/onboarding";
import { sendEmail, isEmailConfigured, appBaseUrl } from "./email";

const MIN_IDLE_DAYS = 4; // don't nudge until they've been gone a few days
const MIN_GAP_DAYS = 14; // never more than one re-engagement per fortnight
const MAX_LIFETIME = 3; // and never more than a few, ever
const BATCH_LIMIT = 40; // cap work per run

function daysSince(iso: string | null | undefined): number {
  if (!iso) return Infinity;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return Infinity;
  return (Date.now() - t) / (1000 * 60 * 60 * 24);
}

/** Decide whether this user is eligible for a gentle nudge right now. */
export function isEligible(user: User): boolean {
  if (!user.email) return false;
  const state = parseOnboardingState(user.onboardingState);
  const email = state.email ?? {};
  if (email.optOut) return false;
  if ((email.reengagementCount ?? 0) >= MAX_LIFETIME) return false;
  if (daysSince(email.lastReengagementAt) < MIN_GAP_DAYS) return false;
  if (daysSince(user.lastLogin) < MIN_IDLE_DAYS) return false;
  return true;
}

interface Cliffhanger {
  campaignId: number;
  campaignTitle: string;
  hook: string | null;
}

/** Find the user's most recent unfinished campaign and its latest cliffhanger. */
async function findCliffhanger(userId: number): Promise<Cliffhanger | null> {
  const rows = await db
    .select({ id: campaigns.id, title: campaigns.title, isCompleted: campaigns.isCompleted })
    .from(campaigns)
    .where(eq(campaigns.userId, userId))
    .orderBy(desc(campaigns.updatedAt))
    .limit(5);

  const active = rows.find((r) => !r.isCompleted) ?? rows[0];
  if (!active) return null;

  const session = await db
    .select({ hook: campaignSessions.cliffhangerHook })
    .from(campaignSessions)
    .where(eq(campaignSessions.campaignId, active.id))
    .orderBy(desc(campaignSessions.sessionNumber))
    .limit(1);

  return {
    campaignId: active.id,
    campaignTitle: active.title ?? "your adventure",
    hook: session[0]?.hook ?? null,
  };
}

function greetingName(user: User): string {
  return user.displayName?.trim() || user.username;
}

interface ComposedEmail {
  subject: string;
  html: string;
  text: string;
  unsubscribeUrl: string;
}

function composeEmail(user: User, cliff: Cliffhanger, token: string): ComposedEmail {
  const base = appBaseUrl();
  const name = greetingName(user);
  const playUrl = `${base}/play`;
  const unsubscribeUrl = `${base}/api/email/unsubscribe?u=${user.id}&t=${token}`;

  const hookLine = cliff.hook
    ? cliff.hook
    : `Your story in “${cliff.campaignTitle}” is still waiting where you left it.`;

  const subject = cliff.hook
    ? `The tale isn't finished…`
    : `Your seat by the fire is still warm`;

  const text = [
    `Hello ${name},`,
    ``,
    `The innkeeper of Lantern Hall asked us to pass along a word:`,
    ``,
    `"${hookLine}"`,
    ``,
    `Pick up where you left off: ${playUrl}`,
    ``,
    `— Everdice`,
    ``,
    `You're receiving this because you have an Everdice account. We only send`,
    `these rarely. To never receive them again: ${unsubscribeUrl}`,
  ].join("\n");

  const html = `
  <div style="max-width:520px;margin:0 auto;font-family:Georgia,'Times New Roman',serif;color:#1c140c;background:#ede4d3;padding:32px 28px;border-radius:10px">
    <p style="font-size:15px;margin:0 0 18px">Hello ${escapeHtml(name)},</p>
    <p style="font-size:15px;margin:0 0 14px;color:#5a4a33">The innkeeper of Lantern Hall asked us to pass along a word:</p>
    <blockquote style="font-style:italic;font-size:18px;line-height:1.6;margin:0 0 22px;padding:14px 18px;border-left:3px solid #d97706;background:rgba(217,119,6,.08)">
      ${escapeHtml(hookLine)}
    </blockquote>
    <p style="text-align:center;margin:26px 0">
      <a href="${playUrl}" style="display:inline-block;background:linear-gradient(180deg,#f5a623,#d97706);color:#1c140c;text-decoration:none;font-weight:bold;font-family:Helvetica,Arial,sans-serif;font-size:15px;letter-spacing:.04em;padding:12px 28px;border-radius:6px">
        Return to your adventure
      </a>
    </p>
    <p style="font-size:11px;color:#8a7a5f;margin:28px 0 0;line-height:1.6">
      You're receiving this because you have an Everdice account. We send these only rarely.
      <a href="${unsubscribeUrl}" style="color:#8a7a5f">Unsubscribe from these gentle reminders.</a>
    </p>
  </div>`;

  return { subject, html, text, unsubscribeUrl };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function recordReengagementEvent(userId: number, campaignId: number) {
  try {
    await db.insert(userActivityEvents).values({
      userId,
      eventType: "reengagement",
      eventCategory: "retention",
      eventName: "email_sent",
      eventData: { campaignId },
      campaignId,
    } as typeof userActivityEvents.$inferInsert);
  } catch (err) {
    console.warn("[reengagement] failed to record event:", (err as Error)?.message);
  }
}

/**
 * Run one pass: find eligible idle players with a cliffhanger and send at most
 * BATCH_LIMIT gentle emails. Returns the number sent. Safe to call when email
 * is unconfigured (it just returns 0 without touching anyone's state).
 */
export async function runReengagementPass(): Promise<number> {
  if (!isEmailConfigured()) return 0;

  const candidates = await db
    .select()
    .from(users)
    .where(isNotNull(users.email))
    .limit(500);

  let sent = 0;
  for (const user of candidates) {
    if (sent >= BATCH_LIMIT) break;
    if (!isEligible(user)) continue;

    const cliff = await findCliffhanger(user.id);
    // Only reach out when there is a genuine reason to return.
    if (!cliff || !cliff.hook) continue;

    const state: OnboardingState = parseOnboardingState(user.onboardingState);
    const token = state.email?.unsubscribeToken ?? randomUUID();
    const composed = composeEmail(user, cliff, token);

    const ok = await sendEmail({
      to: user.email!,
      subject: composed.subject,
      html: composed.html,
      text: composed.text,
      unsubscribeUrl: composed.unsubscribeUrl,
    });
    if (!ok) continue;

    const nextState = mergeOnboardingState(state, {
      email: {
        unsubscribeToken: token,
        lastReengagementAt: new Date().toISOString(),
        reengagementCount: (state.email?.reengagementCount ?? 0) + 1,
      },
    });
    await storage.updateUser(user.id, { onboardingState: nextState as any });
    await recordReengagementEvent(user.id, cliff.campaignId);
    sent++;
  }

  if (sent > 0) console.log(`[reengagement] sent ${sent} gentle reminder(s)`);
  return sent;
}

let timer: ReturnType<typeof setInterval> | null = null;
let lastRunDay: string | null = null;

/**
 * Start the daily scheduler. Checks hourly; runs the pass at most once per
 * calendar day, and only inside a quiet mid-morning window. Fire-and-forget —
 * mirrors initDiscord() in server/index.ts.
 */
export function startReengagementScheduler(): void {
  if (timer) return;
  if (!isEmailConfigured()) {
    console.log("[reengagement] email not configured — scheduler idle (no mail will be sent)");
    return;
  }
  const SEND_HOUR = Number(process.env.REENGAGE_HOUR ?? 10); // local server hour
  const tick = async () => {
    try {
      const now = new Date();
      const day = now.toISOString().slice(0, 10);
      if (now.getHours() !== SEND_HOUR) return;
      if (lastRunDay === day) return;
      lastRunDay = day;
      await runReengagementPass();
    } catch (err) {
      console.warn("[reengagement] scheduler tick failed:", (err as Error)?.message);
    }
  };
  timer = setInterval(tick, 60 * 60 * 1000); // hourly
  console.log(`[reengagement] scheduler started (daily near ${SEND_HOUR}:00 server time)`);
}

export function stopReengagementScheduler(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
