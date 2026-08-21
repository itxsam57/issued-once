BEGIN;

CREATE TABLE IF NOT EXISTS referral_creators (
  id uuid PRIMARY KEY,
  display_name text NOT NULL CHECK (char_length(btrim(display_name)) BETWEEN 1 AND 120),
  email_hash text NOT NULL CHECK (email_hash ~ '^[0-9a-f]{64}$'),
  email_payload_version smallint NOT NULL CHECK (email_payload_version = 1),
  email_key_version text NOT NULL CHECK (email_key_version = 'v1'),
  email_iv text NOT NULL,
  email_auth_tag text NOT NULL,
  email_ciphertext text NOT NULL,
  normalized_code text NOT NULL UNIQUE CHECK (normalized_code ~ '^[A-Z0-9][A-Z0-9-]{1,30}[A-Z0-9]$'),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS referral_creators_email_hash_idx
  ON referral_creators (email_hash);
CREATE INDEX IF NOT EXISTS referral_creators_active_code_idx
  ON referral_creators (normalized_code)
  WHERE active = true;

CREATE TABLE IF NOT EXISTS referral_rule_versions (
  id uuid PRIMARY KEY,
  creator_id uuid NOT NULL REFERENCES referral_creators(id) ON DELETE RESTRICT,
  version integer NOT NULL CHECK (version > 0),
  code_snapshot text NOT NULL CHECK (code_snapshot ~ '^[A-Z0-9][A-Z0-9-]{1,30}[A-Z0-9]$'),
  customer_discount_mode text NOT NULL CHECK (customer_discount_mode IN ('PERCENT','FIXED')),
  customer_discount_bps integer,
  customer_discount_fixed_minor bigint,
  creator_reward_mode text NOT NULL CHECK (creator_reward_mode IN ('PERCENT','FIXED')),
  creator_reward_bps integer,
  creator_reward_fixed_minor bigint,
  payout_cadence text NOT NULL CHECK (payout_cadence IN ('MONTHLY','THRESHOLD')),
  payout_threshold_minor bigint,
  attribution_window_days integer NOT NULL CHECK (attribution_window_days > 0),
  created_at timestamptz NOT NULL,
  UNIQUE (creator_id, version),
  CHECK (
    (customer_discount_mode = 'PERCENT' AND customer_discount_bps BETWEEN 1 AND 9999 AND customer_discount_fixed_minor IS NULL)
    OR
    (customer_discount_mode = 'FIXED' AND customer_discount_fixed_minor > 0 AND customer_discount_bps IS NULL)
  ),
  CHECK (
    (creator_reward_mode = 'PERCENT' AND creator_reward_bps BETWEEN 1 AND 10000 AND creator_reward_fixed_minor IS NULL)
    OR
    (creator_reward_mode = 'FIXED' AND creator_reward_fixed_minor > 0 AND creator_reward_bps IS NULL)
  ),
  CHECK (
    (payout_cadence = 'MONTHLY' AND payout_threshold_minor IS NULL)
    OR
    (payout_cadence = 'THRESHOLD' AND payout_threshold_minor > 0)
  )
);

CREATE INDEX IF NOT EXISTS referral_rule_versions_creator_version_idx
  ON referral_rule_versions (creator_id, version DESC);

CREATE TABLE IF NOT EXISTS referral_attributions (
  id uuid PRIMARY KEY,
  creator_id uuid NOT NULL REFERENCES referral_creators(id) ON DELETE RESTRICT,
  rule_version_id uuid NOT NULL REFERENCES referral_rule_versions(id) ON DELETE RESTRICT,
  source text NOT NULL CHECK (source IN ('LINK','CODE')),
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS referral_attributions_creator_created_idx
  ON referral_attributions (creator_id, created_at DESC);
CREATE INDEX IF NOT EXISTS referral_attributions_expires_idx
  ON referral_attributions (expires_at);

ALTER TABLE checkout_quotes
  ADD COLUMN IF NOT EXISTS gross_amount_minor integer,
  ADD COLUMN IF NOT EXISTS discount_amount_minor integer,
  ADD COLUMN IF NOT EXISTS referral_attribution_id uuid REFERENCES referral_attributions(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS referral_creator_id uuid REFERENCES referral_creators(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS referral_rule_version_id uuid REFERENCES referral_rule_versions(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS referral_rule_snapshot jsonb;

CREATE OR REPLACE FUNCTION fill_checkout_quote_referral_amounts()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.gross_amount_minor IS NULL THEN
    NEW.gross_amount_minor := NEW.amount_minor;
  END IF;
  IF NEW.discount_amount_minor IS NULL THEN
    NEW.discount_amount_minor := 0;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS checkout_quotes_fill_referral_amounts ON checkout_quotes;
CREATE TRIGGER checkout_quotes_fill_referral_amounts
BEFORE INSERT ON checkout_quotes
FOR EACH ROW EXECUTE FUNCTION fill_checkout_quote_referral_amounts();

UPDATE checkout_quotes
SET gross_amount_minor = amount_minor,
    discount_amount_minor = 0
WHERE gross_amount_minor IS NULL OR discount_amount_minor IS NULL;

ALTER TABLE checkout_quotes
  ALTER COLUMN gross_amount_minor SET NOT NULL,
  ALTER COLUMN discount_amount_minor SET NOT NULL;

ALTER TABLE checkout_quotes
  DROP CONSTRAINT IF EXISTS checkout_quotes_referral_amounts_check,
  DROP CONSTRAINT IF EXISTS checkout_quotes_referral_snapshot_check;

ALTER TABLE checkout_quotes
  ADD CONSTRAINT checkout_quotes_referral_amounts_check CHECK (
    gross_amount_minor > 0
    AND discount_amount_minor >= 0
    AND amount_minor > 0
    AND gross_amount_minor - discount_amount_minor = amount_minor
  ),
  ADD CONSTRAINT checkout_quotes_referral_snapshot_check CHECK (
    (
      referral_attribution_id IS NULL
      AND referral_creator_id IS NULL
      AND referral_rule_version_id IS NULL
      AND referral_rule_snapshot IS NULL
      AND discount_amount_minor = 0
    )
    OR
    (
      referral_attribution_id IS NOT NULL
      AND referral_creator_id IS NOT NULL
      AND referral_rule_version_id IS NOT NULL
      AND referral_rule_snapshot IS NOT NULL
      AND discount_amount_minor > 0
    )
  );

CREATE INDEX IF NOT EXISTS checkout_quotes_referral_creator_created_idx
  ON checkout_quotes (referral_creator_id, created_at DESC)
  WHERE referral_creator_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS referral_conversions (
  id uuid PRIMARY KEY,
  creator_id uuid NOT NULL REFERENCES referral_creators(id) ON DELETE RESTRICT,
  rule_version_id uuid NOT NULL REFERENCES referral_rule_versions(id) ON DELETE RESTRICT,
  payment_attempt_id text NOT NULL UNIQUE REFERENCES payment_attempts(id) ON DELETE RESTRICT,
  issue_id uuid REFERENCES issues(id) ON DELETE SET NULL,
  gross_amount_minor bigint NOT NULL CHECK (gross_amount_minor > 0),
  discount_amount_minor bigint NOT NULL CHECK (discount_amount_minor >= 0),
  paid_amount_minor bigint NOT NULL CHECK (paid_amount_minor > 0),
  reward_amount_minor bigint NOT NULL CHECK (reward_amount_minor > 0),
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  rule_snapshot jsonb NOT NULL,
  state text NOT NULL CHECK (state IN ('PENDING','AVAILABLE','REVERSED','PAID_OUT')),
  converted_at timestamptz NOT NULL,
  available_at timestamptz,
  reversed_at timestamptz,
  paid_out_at timestamptz,
  updated_at timestamptz NOT NULL,
  CHECK (gross_amount_minor - discount_amount_minor = paid_amount_minor),
  CHECK ((state <> 'AVAILABLE') OR available_at IS NOT NULL),
  CHECK ((state <> 'REVERSED') OR reversed_at IS NOT NULL),
  CHECK ((state <> 'PAID_OUT') OR paid_out_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS referral_conversions_creator_state_idx
  ON referral_conversions (creator_id, state, converted_at DESC);
CREATE INDEX IF NOT EXISTS referral_conversions_issue_idx
  ON referral_conversions (issue_id)
  WHERE issue_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS referral_notification_deliveries (
  id uuid PRIMARY KEY,
  conversion_id uuid NOT NULL REFERENCES referral_conversions(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('SALE','REVERSAL')),
  state text NOT NULL CHECK (state IN ('QUEUED','SENT','FAILED')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  sent_at timestamptz,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  UNIQUE (conversion_id, kind)
);

CREATE TABLE IF NOT EXISTS referral_payout_requests (
  id uuid PRIMARY KEY,
  creator_id uuid NOT NULL REFERENCES referral_creators(id) ON DELETE RESTRICT,
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  requested_amount_minor bigint NOT NULL CHECK (requested_amount_minor > 0),
  details_payload_version smallint NOT NULL CHECK (details_payload_version = 1),
  details_key_version text NOT NULL CHECK (details_key_version = 'v1'),
  details_iv text NOT NULL,
  details_auth_tag text NOT NULL,
  details_ciphertext text NOT NULL,
  status text NOT NULL CHECK (status IN ('REQUESTED','PAID','CANCELLED')),
  settlement_reference text,
  requested_at timestamptz NOT NULL,
  paid_at timestamptz,
  updated_at timestamptz NOT NULL,
  CHECK ((status <> 'PAID') OR paid_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS referral_payout_requests_creator_status_idx
  ON referral_payout_requests (creator_id, status, requested_at DESC);

CREATE TABLE IF NOT EXISTS referral_payout_allocations (
  payout_id uuid NOT NULL REFERENCES referral_payout_requests(id) ON DELETE RESTRICT,
  conversion_id uuid NOT NULL UNIQUE REFERENCES referral_conversions(id) ON DELETE RESTRICT,
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  allocated_at timestamptz NOT NULL,
  PRIMARY KEY (payout_id, conversion_id)
);

COMMIT;
