-- Campaign invitations can be addressed to a specific existing user, so the
-- invitee (not the DM) chooses which of their characters takes the seat.
-- Additive only: safe to run against production.

ALTER TABLE campaign_invitations
  ADD COLUMN IF NOT EXISTS invited_user_id INTEGER;

CREATE INDEX IF NOT EXISTS idx_campaign_invitations_invited_user_id
  ON campaign_invitations (invited_user_id);
