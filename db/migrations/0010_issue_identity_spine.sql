BEGIN;

ALTER TABLE issues
  ALTER COLUMN fourthwall_order_id DROP NOT NULL,
  ALTER COLUMN fourthwall_event_id DROP NOT NULL;

ALTER TABLE issues
  DROP CONSTRAINT IF EXISTS issues_status_check;

ALTER TABLE issues
  ADD COLUMN IF NOT EXISTS payment_attempt_id text REFERENCES payment_attempts(id),
  ADD COLUMN IF NOT EXISTS experience_id text REFERENCES experiences(id),
  ADD COLUMN IF NOT EXISTS contact_id text REFERENCES verified_contacts(id),
  ADD COLUMN IF NOT EXISTS shipping_snapshot_id text REFERENCES shipping_snapshots(id),
  ADD COLUMN IF NOT EXISTS object_type text,
  ADD COLUMN IF NOT EXISTS amount_minor bigint,
  ADD COLUMN IF NOT EXISTS currency text,
  ADD COLUMN IF NOT EXISTS payment_provider text,
  ADD COLUMN IF NOT EXISTS payment_provider_reference text;

ALTER TABLE issues
  ADD CONSTRAINT issues_status_check CHECK (
    status IN (
      'RESERVED',
      'RECEIVED',
      'BEING_INTERPRETED',
      'DESIGN_REVIEW',
      'DESIGN_APPROVED',
      'MANUFACTURING_DRAFT',
      'IN_PRODUCTION',
      'IN_TRANSIT',
      'DELIVERED',
      'EXCEPTION',
      'CANCELED'
    )
  ) NOT VALID;

ALTER TABLE issues
  ADD CONSTRAINT issues_object_type_check CHECK (
    object_type IS NULL OR object_type IN ('tee', 'hoodie', 'hat', 'tote')
  ) NOT VALID;

ALTER TABLE issues
  ADD CONSTRAINT issues_currency_check CHECK (
    currency IS NULL OR currency ~ '^[A-Z]{3}$'
  ) NOT VALID;

ALTER TABLE issues
  ADD CONSTRAINT issues_amount_minor_check CHECK (
    amount_minor IS NULL OR amount_minor > 0
  ) NOT VALID;

CREATE UNIQUE INDEX IF NOT EXISTS issues_payment_attempt_unique_idx
  ON issues (payment_attempt_id)
  WHERE payment_attempt_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS issues_payment_provider_reference_idx
  ON issues (payment_provider, payment_provider_reference)
  WHERE payment_provider IS NOT NULL AND payment_provider_reference IS NOT NULL;

CREATE INDEX IF NOT EXISTS issues_experience_idx ON issues (experience_id);
CREATE INDEX IF NOT EXISTS issues_contact_idx ON issues (contact_id);

CREATE TABLE IF NOT EXISTS issue_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id uuid NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  source text NOT NULL,
  safe_detail jsonb,
  created_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS issue_events_issue_created_idx
  ON issue_events (issue_id, created_at ASC);

COMMIT;
