/**
 * Minimal, dependency-light transactional email.
 *
 * Design goals:
 *  - GENTLE: if SMTP is not configured, every send silently no-ops (returns
 *    false). The app runs fine with no email credentials — nothing is sent
 *    until an operator opts in by setting the SMTP_* env vars.
 *  - SPARING: throttling / opt-out / cadence live in the caller
 *    (server/lib/reengagement.ts), not here. This module only delivers.
 */
import nodemailer, { type Transporter } from "nodemailer";

let cachedTransport: Transporter | null = null;
let cachedConfigured: boolean | null = null;

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** List-Unsubscribe header target (mailto: or https URL). */
  unsubscribeUrl?: string;
}

/** True when the SMTP env vars needed to actually send are present. */
export function isEmailConfigured(): boolean {
  if (cachedConfigured !== null) return cachedConfigured;
  cachedConfigured = Boolean(
    process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS,
  );
  return cachedConfigured;
}

/** Absolute base URL for links in emails (must be absolute — relative won't work in mail). */
export function appBaseUrl(): string {
  return (
    process.env.APP_BASE_URL ||
    process.env.PUBLIC_URL ||
    "https://everdice.app"
  ).replace(/\/$/, "");
}

/** The From address used for all outbound mail. */
export function emailFrom(): string {
  return (
    process.env.EMAIL_FROM ||
    process.env.SMTP_FROM ||
    "Everdice <no-reply@everdice.realm>"
  );
}

function getTransport(): Transporter | null {
  if (!isEmailConfigured()) return null;
  if (cachedTransport) return cachedTransport;
  cachedTransport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true" || Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  return cachedTransport;
}

/**
 * Send one email. Returns true if handed to the SMTP server, false if email
 * is not configured or the send failed. Never throws — a failed re-engagement
 * email must never break a request or a background job.
 */
export async function sendEmail(msg: EmailMessage): Promise<boolean> {
  const transport = getTransport();
  if (!transport) {
    // Not configured — this is the expected default state, not an error.
    return false;
  }
  try {
    const headers: Record<string, string> = {};
    if (msg.unsubscribeUrl) {
      headers["List-Unsubscribe"] = `<${msg.unsubscribeUrl}>`;
      headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
    }
    await transport.sendMail({
      from: emailFrom(),
      to: msg.to,
      subject: msg.subject,
      text: msg.text,
      html: msg.html,
      headers,
    });
    return true;
  } catch (err) {
    console.warn("[email] send failed:", (err as Error)?.message ?? err);
    return false;
  }
}
