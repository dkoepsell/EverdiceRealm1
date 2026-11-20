/**
 * Signed proof of a server-resolved check. /roll-check returns one; the turn
 * routes accept the roll only from a valid token, so a client can't send a
 * fabricated total. HMAC-SHA256 over the payload with SESSION_SECRET (or a
 * per-process key when unset, which only means tokens don't survive a restart).
 */
import { createHmac, randomBytes, timingSafeEqual } from "crypto";

const KEY = process.env.SESSION_SECRET || randomBytes(32).toString("hex");
const MAX_AGE_MS = 30 * 60 * 1000;

export interface RollTokenPayload {
  campaignId: number;
  userId: number;
  characterId: number;
  skill: string;
  label: string;
  dice: number[];
  kept: number;
  mode: "normal" | "advantage" | "disadvantage";
  modifier: number;
  total: number;
  dc: number;
  success: boolean;
  action: string;
  issuedAt: number;
}

const b64 = (s: string) => Buffer.from(s).toString("base64url");
const sign = (body: string) => createHmac("sha256", KEY).update(body).digest("base64url");

/** Sign any payload that carries campaignId/userId/issuedAt. */
export function signPayload<T extends { campaignId: number; userId: number; issuedAt: number }>(p: T): string {
  const body = b64(JSON.stringify(p));
  return `${body}.${sign(body)}`;
}

export function verifyPayload<T extends { campaignId: number; userId: number; issuedAt: number }>(
  token: unknown,
  expect: { campaignId: number; userId: number },
  now = Date.now(),
): T | null {
  if (typeof token !== "string" || !token.includes(".")) return null;
  const [body, sig] = token.split(".", 2);
  const good = sign(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(good);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString()) as T;
    if (p.campaignId !== expect.campaignId || p.userId !== expect.userId) return null;
    if (now - p.issuedAt > MAX_AGE_MS) return null;
    return p;
  } catch {
    return null;
  }
}

export function signRollToken(p: RollTokenPayload): string {
  return signPayload(p);
}

export function verifyRollToken(token: unknown, expect: { campaignId: number; userId: number }, now = Date.now()): RollTokenPayload | null {
  const p = verifyPayload<RollTokenPayload & { kind?: string }>(token, expect, now);
  return p && p.kind !== "class_turn" ? p : null;
}

/** A combat turn resolved by /combat-action (engagement spec 4.3). */
export interface ClassTurnPayload {
  kind: "class_turn";
  campaignId: number;
  userId: number;
  characterId: number;
  issuedAt: number;
  action: string;
  targetName: string | null;
  hit: boolean;
  attackRoll: { roll: number; modifier: number; total: number; isCritical: boolean; isCriticalMiss: boolean } | null;
  damageTotal: number;
  damageType: string;
  summary: string;
  breakdown: string[];
}

/**
 * The rollResult the turn routes use. A valid token replaces whatever the
 * client sent; without one the client's roll is passed through unchanged
 * (older clients, and campaigns with serverChecks off).
 */
export function trustedRollResult(rollResult: any, expect: { campaignId: number; userId: number }) {
  const turn = verifyPayload<ClassTurnPayload>(rollResult?.token, expect);
  if (turn?.kind === "class_turn") {
    // Shaped like the client's weapon attack so the existing damage path applies it once.
    return {
      type: "class_turn",
      serverResolved: true,
      weaponName: turn.action,
      targetName: turn.targetName,
      hit: turn.hit,
      isHit: turn.hit,
      attackRoll: turn.attackRoll,
      damage: turn.hit && turn.damageTotal > 0 ? { total: turn.damageTotal, damageType: turn.damageType } : undefined,
      summary: turn.summary,
      breakdown: turn.breakdown,
    };
  }
  const p = verifyRollToken(rollResult?.token, expect);
  if (!p) {
    if (rollResult && typeof rollResult === "object") {
      const { token: _t, ...rest } = rollResult;
      return rest;
    }
    return rollResult;
  }
  return {
    diceType: "d20",
    result: p.kept,
    dice: p.dice,
    mode: p.mode,
    modifier: p.modifier,
    total: p.total,
    dc: p.dc,
    success: p.success,
    purpose: p.label,
    skill: p.skill,
    serverResolved: true,
  };
}
