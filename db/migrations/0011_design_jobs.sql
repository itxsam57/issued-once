BEGIN;

CREATE TABLE IF NOT EXISTS design_jobs (
  id uuid PRIMARY KEY,
  issue_id uuid NOT NULL UNIQUE REFERENCES issues(id) ON DELETE CASCADE,
  state text NOT NULL CHECK (state IN ('QUEUED','INTERPRETING','GENERATING','REVIEW','APPROVED','FAILED')),
  brief_payload_version smallint,
  brief_key_version text,
  brief_iv text,
  brief_auth_tag text,
  brief_ciphertext text,
  artwork_url text,
  artwork_mime_type text,
  artwork_bytes bigint,
  artwork_width integer,
  artwork_height integer,
  provider text,
  model text,
  failure_code text,
  approved_at timestamptz,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  CHECK (
    (brief_payload_version IS NULL AND brief_key_version IS NULL AND brief_iv IS NULL AND brief_auth_tag IS NULL AND brief_ciphertext IS NULL)
    OR
    (brief_payload_version = 1 AND brief_key_version = 'v1' AND brief_iv IS NOT NULL AND brief_auth_tag IS NOT NULL AND brief_ciphertext IS NOT NULL)
  ),
  CHECK (artwork_bytes IS NULL OR artwork_bytes > 0),
  CHECK (artwork_width IS NULL OR artwork_width > 0),
  CHECK (artwork_height IS NULL OR artwork_height > 0)
);

CREATE INDEX IF NOT EXISTS design_jobs_state_created_idx
  ON design_jobs (state, created_at);

COMMIT;
