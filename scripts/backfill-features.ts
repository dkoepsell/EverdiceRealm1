/**
 * Backfill for scripts/migrations/001-level-ups.sql.
 * Run with: npx tsx scripts/backfill-features.ts [--dry-run]
 *
 * - characters.features: built from class + level (base class features only;
 *   a character past their subclass level picks their SRD subclass at their
 *   next level-up, which the Level Up dialog offers as a catch-up step).
 * - characters.hit_dice_remaining: set to level where null (full Hit Dice).
 *
 * Safe to re-run: only touches rows whose features are empty / hit dice null.
 */
import dotenv from "dotenv";
dotenv.config({ override: true });

import { db } from "../server/db";
import { characters } from "@shared/schema";
import { eq } from "drizzle-orm";
import { ABILITY_NAMES, type AbilityName } from "@shared/rules/abilities";
import { getClassDef } from "@shared/rules/classProgression";
import { buildFeatureState, parseFeatureState } from "@shared/rules/leveling";

const dryRun = process.argv.includes("--dry-run");

async function main() {
  const rows = await db.select().from(characters);
  let featuresSet = 0;
  let hitDiceSet = 0;
  for (const c of rows) {
    const update: Record<string, unknown> = {};
    const def = getClassDef(c.class);
    if (def && parseFeatureState(c.features).length === 0) {
      const scores = {} as Record<AbilityName, number>;
      for (const a of ABILITY_NAMES) scores[a] = Number((c as any)[a]) || 10;
      update.features = buildFeatureState(def, Math.min(c.level || 1, def.maxEncodedLevel), c.subclass, scores);
      featuresSet++;
    }
    if (c.hitDiceRemaining == null) {
      update.hitDiceRemaining = c.level || 1;
      hitDiceSet++;
    }
    if (Object.keys(update).length && !dryRun) {
      await db.update(characters).set(update).where(eq(characters.id, c.id));
    }
  }
  console.log(`${dryRun ? "[dry run] " : ""}${rows.length} characters: features set on ${featuresSet}, hit dice set on ${hitDiceSet}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
