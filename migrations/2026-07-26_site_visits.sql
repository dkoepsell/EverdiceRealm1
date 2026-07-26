-- Anonymous-capable pageview log powering the admin Visitors / Referrers cards.
--
-- Additive only: CREATE TABLE + indexes, no ALTER of anything existing. Run this
-- by hand (psql "$DATABASE_URL" -f migrations/2026-07-26_site_visits.sql).
-- Do NOT reach for `npm run db:push` — drizzle-kit proposes dropping the
-- `session` table (connect-pg-simple's store, absent from the Drizzle schema),
-- which logs every user out.
--
-- No IP address is stored, hashed or otherwise. visit_token and session_id are
-- random client-generated values, so a row identifies a visit, not a person.

CREATE TABLE IF NOT EXISTS site_visits (
  id             SERIAL PRIMARY KEY,
  visit_token    TEXT NOT NULL UNIQUE,
  session_id     TEXT NOT NULL,
  user_id        INTEGER,
  path           TEXT NOT NULL,
  referrer_host  TEXT,
  referrer_url   TEXT,
  utm_source     TEXT,
  utm_medium     TEXT,
  utm_campaign   TEXT,
  landing_path   TEXT,
  is_landing     BOOLEAN NOT NULL DEFAULT FALSE,
  device_type    TEXT,
  duration_ms    INTEGER,
  created_at     TEXT NOT NULL DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
);

CREATE INDEX IF NOT EXISTS idx_site_visits_created_at    ON site_visits (created_at);
CREATE INDEX IF NOT EXISTS idx_site_visits_session_id    ON site_visits (session_id);
CREATE INDEX IF NOT EXISTS idx_site_visits_referrer_host ON site_visits (referrer_host);
CREATE INDEX IF NOT EXISTS idx_site_visits_path          ON site_visits (path);
