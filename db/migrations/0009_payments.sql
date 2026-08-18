BEGIN;

CREATE TABLE IF NOT EXISTS payment_attempts (
  id text PRIMARY KEY,
  experience_id text NOT NULL REFERENCES experiences(id),
  quote_id text NOT NULL REFERENCES checkout_quotes(id),
  contact_id text NOT NULL REFERENCES verified_contacts(id),
  shipping_snapshot_id text NOT NULL REFERENCES shipping_snapshots(id),
  provider text NOT NULL CHECK (provider IN ('SAFEPAY')),
  provider_reference text,
  checkout_url text,
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  status text NOT NULL CHECK (status IN ('CREATED','REDIRECTED','PAID','FAILED','REFUNDED','EXCEPTION')),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  UNIQUE (provider, provider_reference)
);

CREATE UNIQUE INDEX IF NOT EXISTS payment_attempts_active_quote_idx
  ON payment_attempts (experience_id, quote_id)
  WHERE status IN ('CREATED','REDIRECTED','PAID');

CREATE INDEX IF NOT EXISTS payment_attempts_experience_idx
  ON payment_attempts (experience_id, created_at DESC);

CREATE TABLE IF NOT EXISTS payment_provider_events (
  provider text NOT NULL CHECK (provider IN ('SAFEPAY')),
  provider_event_id text NOT NULL,
  provider_reference text NOT NULL,
  state text NOT NULL,
  amount_minor bigint NOT NULL CHECK (amount_minor >= 0),
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  reference text,
  received_at timestamptz NOT NULL,
  PRIMARY KEY (provider, provider_event_id)
);

CREATE INDEX IF NOT EXISTS payment_provider_events_reference_idx
  ON payment_provider_events (provider, provider_reference, received_at DESC);

COMMIT;
