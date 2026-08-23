BEGIN;

CREATE TABLE IF NOT EXISTS checkout_quotes (
  id text PRIMARY KEY,
  experience_id text NOT NULL REFERENCES experiences(id) ON DELETE CASCADE,
  product_slug text NOT NULL,
  variant_id text NOT NULL,
  amount_minor integer NOT NULL CHECK (amount_minor >= 0),
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS checkout_quotes_experience_expires_idx
  ON checkout_quotes (experience_id, expires_at);

CREATE INDEX IF NOT EXISTS checkout_quotes_expires_at_idx
  ON checkout_quotes (expires_at);

COMMIT;
