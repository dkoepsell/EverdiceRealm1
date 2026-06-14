import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";
import { randomUUID } from "crypto";
import * as OTPAuth from "otplib";
import QRCode from "qrcode";
import { z } from "zod";
import { pool } from "./db";

const authenticator = OTPAuth.authenticator;

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function setupAuth(app: Express) {
  const PgStore = connectPgSimple(session);

  const sessionSettings: session.SessionOptions = {
    store: new PgStore({
      pool,
      tableName: 'session',
      createTableIfMissing: true,
    }),
    secret: process.env.SESSION_SECRET || randomUUID(),
    resave: false,
    saveUninitialized: false,
    cookie: {
      // Set COOKIE_SECURE=true in .env only when the server is behind HTTPS.
      // Defaults to false so HTTP deployments work; HTTPS deployments must opt in.
      secure: process.env.COOKIE_SECURE === 'true',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    }
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user || !(await comparePasswords(password, user.password))) {
          return done(null, false);
        } else {
          // Update last login time
          await storage.updateUserLastLogin(user.id);
          return done(null, user);
        }
      } catch (error) {
        return done(error);
      }
    }),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (error) {
      done(error);
    }
  });

  // Register endpoint
  app.post("/api/register", async (req, res, next) => {
    try {
      const existingUser = await storage.getUserByUsername(req.body.username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      // Keep it simple for now, just username and password
      const user = await storage.createUser({
        username: req.body.username,
        password: await hashPassword(req.body.password)
      });

      req.login(user, async (err) => {
        if (err) return next(err);
        try {
          await storage.updateUser(user.id, { lastLogin: new Date().toISOString() });
        } catch (e) {
          console.warn("Failed to update lastLogin:", e);
        }
        const { password, twoFactorSecret, ...userWithoutSensitive } = user;
        res.status(201).json(userWithoutSensitive);
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ message: "Registration failed" });
    }
  });

  // Login endpoint
  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err, user, info) => {
      if (err) return next(err);
      if (!user) {
        return res.status(401).json({ message: "Invalid username or password" });
      }
      req.login(user, async (err) => {
        if (err) return next(err);
        try {
          await storage.updateUser(user.id, { lastLogin: new Date().toISOString() });
        } catch (e) {
          console.warn("Failed to update lastLogin:", e);
        }
        const { password, twoFactorSecret, ...userWithoutSensitive } = user;
        res.status(200).json(userWithoutSensitive);
      });
    })(req, res, next);
  });

  // Logout endpoint
  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  // Current user info endpoint
  app.get("/api/user", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const currentUser = req.user as SelectUser;
    const lastLogin = currentUser.lastLogin ? new Date(currentUser.lastLogin).getTime() : 0;
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    if (lastLogin < oneHourAgo) {
      storage.updateUser(currentUser.id, { lastLogin: new Date().toISOString() }).catch(() => {});
    }
    const { password, twoFactorSecret, ...userWithoutSensitive } = currentUser;
    res.json({ ...userWithoutSensitive, twoFactorEnabled: currentUser.twoFactorEnabled });
  });

  // Update profile endpoint
  app.patch("/api/user/profile", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    try {
      const userId = (req.user as SelectUser).id;
      
      const profileSchema = z.object({
        displayName: z.string().min(1).max(100).optional(),
        email: z.string().email().optional().nullable()
      });
      
      const parseResult = profileSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ message: "Invalid input", errors: parseResult.error.flatten() });
      }
      
      const { displayName, email } = parseResult.data;
      
      const updates: { displayName?: string; email?: string | null } = {};
      if (displayName !== undefined) updates.displayName = displayName;
      if (email !== undefined) updates.email = email;
      
      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ message: "No valid fields to update" });
      }
      
      const updated = await storage.updateUserProfile(userId, updates);
      if (!updated) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const { password, twoFactorSecret, ...userWithoutSensitive } = updated;
      res.json(userWithoutSensitive);
    } catch (error) {
      console.error("Failed to update profile:", error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  // Change password endpoint
  app.post("/api/user/change-password", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    try {
      const userId = (req.user as SelectUser).id;
      const { currentPassword, newPassword } = req.body;
      
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "Current and new password are required" });
      }
      
      if (newPassword.length < 6) {
        return res.status(400).json({ message: "New password must be at least 6 characters" });
      }
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const isValid = await comparePasswords(currentPassword, user.password);
      if (!isValid) {
        return res.status(400).json({ message: "Current password is incorrect" });
      }
      
      const hashedPassword = await hashPassword(newPassword);
      await storage.updateUser(userId, { password: hashedPassword });
      
      res.json({ message: "Password changed successfully" });
    } catch (error) {
      console.error("Failed to change password:", error);
      res.status(500).json({ message: "Failed to change password" });
    }
  });

  // 2FA Setup - Generate secret and QR code
  app.post("/api/user/2fa/setup", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    try {
      const user = req.user as SelectUser;
      
      if (user.twoFactorEnabled) {
        return res.status(400).json({ message: "2FA is already enabled" });
      }
      
      const secret = authenticator.generateSecret();
      const otpauth = authenticator.keyuri(user.username, "Everdice", secret);
      
      // Store secret temporarily (not enabled yet)
      await storage.updateUser(user.id, { twoFactorSecret: secret });
      
      const qrCodeDataUrl = await QRCode.toDataURL(otpauth);
      
      res.json({
        qrCode: qrCodeDataUrl,
        message: "Scan QR code with your authenticator app, then verify with a code"
      });
    } catch (error) {
      console.error("Failed to setup 2FA:", error);
      res.status(500).json({ message: "Failed to setup 2FA" });
    }
  });

  // 2FA Enable - Verify code and enable
  app.post("/api/user/2fa/enable", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    try {
      const user = req.user as SelectUser;
      const { code } = req.body;
      
      if (!code) {
        return res.status(400).json({ message: "Verification code is required" });
      }
      
      // Get the latest user data with secret
      const currentUser = await storage.getUser(user.id);
      if (!currentUser?.twoFactorSecret) {
        return res.status(400).json({ message: "Please setup 2FA first" });
      }
      
      const isValid = authenticator.verify({ token: code, secret: currentUser.twoFactorSecret });
      if (!isValid) {
        return res.status(400).json({ message: "Invalid verification code" });
      }
      
      await storage.updateUser(user.id, { twoFactorEnabled: true });
      
      res.json({ message: "2FA enabled successfully" });
    } catch (error) {
      console.error("Failed to enable 2FA:", error);
      res.status(500).json({ message: "Failed to enable 2FA" });
    }
  });

  // 2FA Disable
  app.post("/api/user/2fa/disable", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    try {
      const user = req.user as SelectUser;
      const { password } = req.body;
      
      if (!password) {
        return res.status(400).json({ message: "Password is required to disable 2FA" });
      }
      
      const currentUser = await storage.getUser(user.id);
      if (!currentUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const isValid = await comparePasswords(password, currentUser.password);
      if (!isValid) {
        return res.status(400).json({ message: "Invalid password" });
      }
      
      await storage.updateUser(user.id, { twoFactorEnabled: false, twoFactorSecret: null });
      
      res.json({ message: "2FA disabled successfully" });
    } catch (error) {
      console.error("Failed to disable 2FA:", error);
      res.status(500).json({ message: "Failed to disable 2FA" });
    }
  });
}

// Authentication middleware
export function isAuthenticated(req: any, res: any, next: any) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Authentication required" });
}

// Admin middleware - must be used after isAuthenticated
export function requireAdmin(req: any, res: any, next: any) {
  if (req.user?.isAdmin) {
    return next();
  }
  res.status(403).json({ message: "Admin access required" });
}