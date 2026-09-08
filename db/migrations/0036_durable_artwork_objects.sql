CREATE TABLE IF NOT EXISTS artwork_objects (
  locator text PRIMARY KEY,
  issue_id uuid NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  design_job_id text NOT NULL,
  mime_type text NOT NULL CHECK (mime_type = 'image/png'),
  bytes bytea NOT NULL,
  byte_count bigint NOT NULL CHECK (byte_count > 0),
  content_sha256 text NOT NULL CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT artwork_objects_locator_private CHECK (locator LIKE 'artwork://%'),
  CONSTRAINT artwork_objects_byte_count_matches CHECK (octet_length(bytes) = byte_count),
  UNIQUE (issue_id, design_job_id)
);

CREATE INDEX IF NOT EXISTS artwork_objects_issue_created_idx
  ON artwork_objects(issue_id, created_at DESC);
