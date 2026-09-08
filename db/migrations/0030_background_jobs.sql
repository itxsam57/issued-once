BEGIN;

CREATE TABLE IF NOT EXISTS background_jobs (
  id uuid PRIMARY KEY,
  topic text NOT NULL,
  payload jsonb NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  state text NOT NULL DEFAULT 'PENDING'
    CHECK (state IN ('PENDING','PROCESSING','COMPLETED','FAILED')),
  available_at timestamptz NOT NULL DEFAULT NOW(),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts integer NOT NULL DEFAULT 6 CHECK (max_attempts > 0),
  lease_owner text,
  lease_expires_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CHECK (
    (state = 'PROCESSING' AND lease_owner IS NOT NULL AND lease_expires_at IS NOT NULL)
    OR
    (state <> 'PROCESSING' AND lease_owner IS NULL AND lease_expires_at IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS background_jobs_due_idx
  ON background_jobs (state, available_at, topic, created_at);

COMMIT;
