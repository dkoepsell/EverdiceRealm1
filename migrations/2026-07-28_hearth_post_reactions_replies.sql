-- Thumbs-up reactions and flat replies on Hearth board posts, so the noticeboard
-- reads as a conversation instead of a wall of orphan notes.
--
-- Additive only: two CREATE TABLEs + indexes, no ALTER of anything existing. Run this
-- by hand (psql "$DATABASE_URL" -f migrations/2026-07-28_hearth_post_reactions_replies.sql).
-- Do NOT reach for `npm run db:push` — drizzle-kit proposes dropping the
-- `session` table (connect-pg-simple's store, absent from the Drizzle schema),
-- which logs every user out.
--
-- No FK to hearth_board_posts on purpose: posts are soft-deleted (deleted_at), never
-- removed, and the read paths already join through the post row. Keeping these tables
-- unconstrained matches how hearth_events and hearth_presence reference users.

CREATE TABLE IF NOT EXISTS hearth_post_reactions (
  id         SERIAL PRIMARY KEY,
  post_id    INTEGER NOT NULL,
  user_id    INTEGER NOT NULL,
  kind       TEXT NOT NULL DEFAULT 'up',
  created_at TEXT NOT NULL DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
);

-- One reaction per person per post per kind. This is what makes reacting a toggle
-- rather than a counter anyone can hammer.
CREATE UNIQUE INDEX IF NOT EXISTS uq_hearth_post_reaction
  ON hearth_post_reactions (post_id, user_id, kind);
CREATE INDEX IF NOT EXISTS idx_hearth_post_reactions_post
  ON hearth_post_reactions (post_id);

CREATE TABLE IF NOT EXISTS hearth_post_replies (
  id         SERIAL PRIMARY KEY,
  post_id    INTEGER NOT NULL,
  user_id    INTEGER NOT NULL,
  body       TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_hearth_post_replies_post
  ON hearth_post_replies (post_id);
