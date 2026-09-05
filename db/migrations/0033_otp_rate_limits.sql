BEGIN;

CREATE TABLE IF NOT EXISTS otp_rate_limits (
  subject_kind text NOT NULL CHECK (subject_kind IN ('email', 'experience', 'ip')),
  subject_hash text NOT NULL CHECK (subject_hash ~ '^[0-9a-f]{64}$'),
  short_window_started_at timestamptz NOT NULL,
  short_count integer NOT NULL CHECK (short_count > 0),
  long_window_started_at timestamptz NOT NULL,
  long_count integer NOT NULL CHECK (long_count > 0),
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (subject_kind, subject_hash)
);

CREATE INDEX IF NOT EXISTS otp_rate_limits_updated_at_idx
  ON otp_rate_limits (updated_at);

COMMIT;
