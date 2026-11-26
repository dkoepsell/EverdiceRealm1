/**
 * One-shot nights (table-night spec): a friend opens an invite link, picks a
 * ready-made character and plays, with no account first. Later they can keep
 * the character by choosing a username and password.
 *
 *   GET  /api/table/pregens            the ready-made characters (cards)
 *   POST /api/table/pregen             { key } create one for the signed-in user
 *   POST /api/table/guest              { code, key, name? } sign in as a guest and
 *                                      create the character; the client then accepts
 *                                      the invite with the usual /api/invitations/:code/accept
 *   POST /api/table/claim              { username, password, email? } turn the guest
 *                                      into a real account, keeping everything
 *
 * Guests are ordinary users whose username starts with "guest-" (reserved at
 * registration) and whose onboarding_state has guest: true, so no migration.
 * A guest can only be created from a valid, pending invitation, and at most
 * a few per IP per hour.
 */
import type { Express, Request } from "express";
import { randomBytes } from "crypto";
import { storage } from "../../storage";
import { hashPassword } from "../../auth";
import { GUEST_PREFIX, isGuestUsername, pregenByKey, pregenCards, type Pregen } from "@shared/rules/pregens";
import { getClassDef } from "@shared/rules/classProgression";
import { buildFeatureState } from "@shared/rules/leveling";

const GUESTS_PER_IP_PER_HOUR = 6;
const recentGuests = new Map<string, number[]>();

function ipOf(req: Request): string {
  return String((req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0] ?? req.socket.remoteAddress ?? "?").trim();
}

function allowGuest(ip: string): boolean {
  const now = Date.now();
  const list = (recentGuests.get(ip) ?? []).filter((t) => now - t < 3600_000);
  if (list.length >= GUESTS_PER_IP_PER_HOUR) {
    recentGuests.set(ip, list);
    return false;
  }
  list.push(now);
  recentGuests.set(ip, list);
  return true;
}

/** The character row for a pregen, with SRD features for level 3. */
export function pregenCharacterRow(p: Pregen, userId: number, nameOverride?: string | null) {
  const def = getClassDef(p.className);
  const features = def ? buildFeatureState(def, 3, p.subclass, p.abilities) : [];
  const withExpertise = p.expertise?.length
    ? features.map((f) => (f.id === "expertise" ? { ...f, choices: p.expertise } : f))
    : features;
  return {
    userId,
    name: nameOverride?.trim() ? nameOverride.trim().slice(0, 40) : p.name,
    race: p.race,
    class: p.className,
    subclass: p.subclass,
    level: 3,
    experience: 900,
    background: p.background,
    alignment: p.alignment,
    ...p.abilities,
    hitPoints: p.hitPoints,
    maxHitPoints: p.hitPoints,
    armorClass: p.armorClass,
    hitDiceRemaining: 3,
    skills: p.skills,
    equipment: [p.weapon, p.armor, ...p.extraEquipment],
    equippedWeapon: p.weapon,
    equippedArmor: p.armor,
    equippedShield: p.extraEquipment.includes("Shield") ? "Shield" : null,
    features: withExpertise,
    personality: p.personality,
    appearance: p.appearance,
    gold: 25,
    silver: 20,
    consumables: [{ name: "Healing Potion", quantity: 2, type: "healing", effect: "Restores 2d4+2 HP", healDice: "2d4", healBonus: 2 }],
  };
}

export function registerTableRoutes(app: Express) {
  app.get("/api/table/pregens", (_req, res) => {
    res.json({ pregens: pregenCards() });
  });

  app.post("/api/table/pregen", async (req, res) => {
    try {
      if (!req.isAuthenticated?.() || !req.user) return res.status(401).json({ message: "Not authenticated" });
      const p = pregenByKey(req.body?.key);
      if (!p) return res.status(400).json({ message: "Unknown character" });
      const userId = (req.user as any).id as number;
      const mine = await storage.getCharactersByUserId(userId);
      const base = typeof req.body?.name === "string" && req.body.name.trim() ? req.body.name.trim().slice(0, 40) : p.name;
      // Picking the same hero twice gets a distinct name rather than an error.
      let name = base;
      for (let i = 2; mine.some((c: any) => c.name.toLowerCase() === name.toLowerCase()); i++) name = `${base} ${i}`;
      const character = await storage.createCharacter(pregenCharacterRow(p, userId, name) as any);
      res.status(201).json(character);
    } catch (err) {
      console.error("[table] pregen failed:", err);
      res.status(500).json({ message: "Couldn't create the character" });
    }
  });

  app.post("/api/table/guest", async (req, res, next) => {
    try {
      if (req.isAuthenticated?.() && req.user) return res.status(400).json({ message: "You're already signed in." });
      const code = String(req.body?.code ?? "");
      const invitation = code ? await storage.getCampaignInvitationByCode(code) : null;
      if (!invitation || invitation.status !== "pending") return res.status(404).json({ message: "This invitation has expired or was already used." });
      const p = pregenByKey(req.body?.key);
      if (!p) return res.status(400).json({ message: "Pick a character first." });
      if (!allowGuest(ipOf(req))) return res.status(429).json({ message: "Too many guest players from here in the last hour. Try again later, or sign up." });

      const playerName = typeof req.body?.name === "string" ? req.body.name.trim().slice(0, 30) : "";
      const username = `${GUEST_PREFIX}${randomBytes(5).toString("hex")}`;
      const user = await storage.createUser({ username, password: await hashPassword(randomBytes(24).toString("hex")) } as any);
      await storage.updateUser(user.id, {
        displayName: playerName || `Guest ${username.slice(-4)}`,
        lastLogin: new Date().toISOString(),
        onboardingState: { guest: true, guestSince: new Date().toISOString(), funnel: { step: "done" } } as any,
      } as any);
      const character = await storage.createCharacter(pregenCharacterRow(p, user.id) as any);
      req.login(user, (err) => {
        if (err) return next(err);
        res.status(201).json({ characterId: character.id, characterName: character.name, guest: true });
      });
    } catch (err) {
      console.error("[table] guest join failed:", err);
      res.status(500).json({ message: "Couldn't start a guest seat" });
    }
  });

  app.post("/api/table/claim", async (req, res) => {
    try {
      if (!req.isAuthenticated?.() || !req.user) return res.status(401).json({ message: "Not authenticated" });
      const me = await storage.getUser((req.user as any).id);
      if (!me || !isGuestUsername(me.username)) return res.status(400).json({ message: "This account is already yours to keep." });
      const username = String(req.body?.username ?? "").trim();
      const password = String(req.body?.password ?? "");
      if (username.length < 3 || username.length > 30 || !/^[A-Za-z0-9_.-]+$/.test(username)) {
        return res.status(400).json({ message: "Usernames are 3-30 letters, numbers, dots, dashes or underscores." });
      }
      if (isGuestUsername(username)) return res.status(400).json({ message: "Pick a username that doesn't start with \"guest-\"." });
      if (password.length < 8) return res.status(400).json({ message: "Use a password of at least 8 characters." });
      if (await storage.getUserByUsername(username)) return res.status(400).json({ message: "That username is taken." });
      const email = typeof req.body?.email === "string" && req.body.email.trim() ? req.body.email.trim() : undefined;
      const state = (me.onboardingState && typeof me.onboardingState === "object" ? me.onboardingState : {}) as Record<string, unknown>;
      const updated = await storage.updateUser(me.id, {
        username,
        password: await hashPassword(password),
        ...(email ? { email } : {}),
        displayName: me.displayName && !/^Guest /.test(me.displayName) ? me.displayName : username,
        onboardingState: { ...state, guest: false, claimedAt: new Date().toISOString() } as any,
      } as any);
      const { password: _pw, twoFactorSecret: _tfs, ...safe } = (updated ?? me) as any;
      res.json(safe);
    } catch (err) {
      console.error("[table] claim failed:", err);
      res.status(500).json({ message: "Couldn't save your account" });
    }
  });
}
