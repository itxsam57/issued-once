BEGIN;

CREATE TABLE IF NOT EXISTS referral_creator_outreach_deliveries (
  id uuid PRIMARY KEY,
  creator_id uuid NOT NULL REFERENCES referral_creators(id) ON DELETE RESTRICT,
  campaign text NOT NULL CHECK (campaign ~ '^[a-z0-9][a-z0-9_-]{2,63}$'),
  state text NOT NULL CHECK (state IN ('QUEUED','SENT','FAILED')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  sent_at timestamptz,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  UNIQUE (creator_id, campaign)
);

CREATE INDEX IF NOT EXISTS referral_creator_outreach_state_idx
  ON referral_creator_outreach_deliveries (campaign, state, updated_at);

COMMIT;
