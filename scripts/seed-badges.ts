/**
 * One-time badge seed script.
 * Run with: npx tsx scripts/seed-badges.ts
 *
 * Safe to re-run — uses INSERT ... ON CONFLICT DO NOTHING.
 */
import dotenv from "dotenv";
dotenv.config({ override: true });

import { db } from "../server/db";
import { badges } from "@shared/schema";
import { sql } from "drizzle-orm";

const BADGES = [
  {
    name: "Baptism of Fire",
    description: "Survived and won your first real fight.",
    icon: "⚔️",
    category: "gameplay",
    tier: "bronze",
    color: "#CD7F32",
  },
  {
    name: "Opening Act",
    description: "Completed the first chapter of a campaign.",
    icon: "📜",
    category: "gameplay",
    tier: "bronze",
    color: "#CD7F32",
  },
  {
    name: "Legend of the Realm",
    description: "Saw a full campaign through to its end.",
    icon: "🏆",
    category: "gameplay",
    tier: "gold",
    color: "#FFD700",
  },
  {
    name: "Regular at the Hearth",
    description: "Returned to the Hearth seven days running.",
    icon: "🔥",
    category: "social",
    tier: "silver",
    color: "#C0C0C0",
  },
  {
    name: "Blessed by the Dice Gods",
    description: "Rolled a natural 20 in the heat of the moment.",
    icon: "🎲",
    category: "gameplay",
    tier: "silver",
    color: "#C0C0C0",
  },
  {
    name: "Merchant of the Realm",
    description: "Listed your first item in the Trading Post.",
    icon: "⚖️",
    category: "social",
    tier: "bronze",
    color: "#CD7F32",
  },
];

async function seedBadges() {
  console.log("Seeding badges...");
  for (const badge of BADGES) {
    await db.insert(badges).values(badge).onConflictDoNothing();
    console.log(`  ✓ ${badge.name}`);
  }
  console.log("Done.");
  process.exit(0);
}

seedBadges().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
