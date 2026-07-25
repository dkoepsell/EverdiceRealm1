-- 2026-07-25: co-admin role, feedback inbox columns, and board moderation.
-- Additive and idempotent. Safe to run more than once.
-- Run against the LOCAL Postgres on the prod box. Do NOT use `npm run db:push`.

-- ---------------------------------------------------------------------------
-- 1. user_feedback: columns added in commit 6dae4e2 that were never migrated.
--    Until these exist, GET /api/admin/feedback throws at the DB layer and the
--    admin Feedback tab is dead.
-- ---------------------------------------------------------------------------
ALTER TABLE user_feedback
  ADD COLUMN IF NOT EXISTS rating        integer,
  ADD COLUMN IF NOT EXISTS category      text,
  ADD COLUMN IF NOT EXISTS comment       text,
  ADD COLUMN IF NOT EXISTS felt_confusing boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS felt_slow     boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS would_use     boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS page_path     text,
  ADD COLUMN IF NOT EXISTS is_read       boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS user_feedback_is_read_idx ON user_feedback (is_read);

-- ---------------------------------------------------------------------------
-- 2. Co-admin role.
--    is_admin  = full admin (can grant/revoke admin and co-admin)
--    is_co_admin = staff: analytics + feedback inbox + board moderation only
-- ---------------------------------------------------------------------------
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_co_admin boolean NOT NULL DEFAULT false;

-- ---------------------------------------------------------------------------
-- 3. Bulletin board moderation: soft delete + audit trail.
--    Previously DELETE /api/bulletin/:id hard-deleted with no admin override.
-- ---------------------------------------------------------------------------
ALTER TABLE bulletin_posts
  ADD COLUMN IF NOT EXISTS deleted_at text,
  ADD COLUMN IF NOT EXISTS deleted_by integer;

CREATE INDEX IF NOT EXISTS bulletin_posts_deleted_at_idx ON bulletin_posts (deleted_at);

-- ---------------------------------------------------------------------------
-- 4. Grant co-admin to Amos Elberg.
--    He signed up as "Amos.elberg@gmail.com" — match case-insensitively.
-- ---------------------------------------------------------------------------
UPDATE users SET is_co_admin = true WHERE lower(email) = 'amos.elberg@gmail.com';
