-- Engagement spec Phase 1–2: level-ups with real 5e choices, Hit Dice,
-- Inspiration. Additive and idempotent. Run by hand (see EverdiceDeploy.txt);
-- never `npm run db:push` against production.
ALTER TABLE characters ADD COLUMN IF NOT EXISTS features jsonb DEFAULT '[]'::jsonb;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS subclass text;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS pending_level_up jsonb;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS hit_dice_remaining integer;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS inspiration boolean DEFAULT false;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS personality jsonb;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS leveling_mode text DEFAULT 'milestone';
-- After this, run: npx tsx scripts/backfill-features.ts
-- (fills characters.features from class + level; hit dice default to level).
